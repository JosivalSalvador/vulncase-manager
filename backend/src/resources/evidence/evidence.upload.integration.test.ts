import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { getStoredFilePath, MAX_UPLOAD_BYTES } from "../../lib/storage.js"
import {
  fileForm,
  makeExecutable,
  makePng,
  makeText,
} from "../../test/files.js"
import {
  addMember,
  createFinding,
  createProject,
  errorOf,
} from "../../test/fixtures.js"
import {
  bodyOf,
  cleanupTestUsers,
  createUser,
  signIn,
  startServer,
  TestClient,
  uniqueEmail,
  type ApiResponse,
  type TestServer,
} from "../../test/helpers.js"

// Envio de evidências. O analista é dono do projeto e envia os arquivos; o
// leitor (VIEWER) é membro do projeto, mas só pode olhar. Os arquivos são
// montados em memória (veja src/test/files.ts).
let server: TestServer
let anonymous: TestClient
let analyst: TestClient
let analystId: string
let viewer: TestClient

let projectId: string
// Achado dos envios que dão certo.
let findingId: string
// Achado dos envios recusados: no fim de cada teste ele precisa continuar vazio.
let refusedFindingId: string

function evidenceUrl(finding: string): string {
  return `/projects/${projectId}/findings/${finding}/evidence`
}

function countEvidence(finding: string): Promise<number> {
  return prisma.evidence.count({ where: { findingId: finding } })
}

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  anonymous = new TestClient(server.baseUrl)
  await anonymous.refreshCsrf()

  const analystUser = await createUser({ email: uniqueEmail("analista") })
  const viewerUser = await createUser({
    role: "VIEWER",
    email: uniqueEmail("leitor"),
  })
  analystId = analystUser.id
  analyst = await signIn(server.baseUrl, analystUser.email)
  viewer = await signIn(server.baseUrl, viewerUser.email)

  projectId = await createProject(analyst, "Projeto de evidências")
  await addMember(analyst, projectId, viewerUser.email)
  findingId = await createFinding(analyst, projectId, {
    title: "Achado dos envios que dão certo",
  })
  refusedFindingId = await createFinding(analyst, projectId, {
    title: "Achado dos envios recusados",
  })
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

describe("envio por um analista", (): void => {
  it("PNG válido: 201, só os campos públicos, e o arquivo vai para o disco com nome gerado", async (): Promise<void> => {
    const png: Buffer = makePng()

    const response: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(png, "captura.png", "image/png"),
    )

    expect(response.status).toBe(201)
    const body = bodyOf(response)
    // O nome gravado no disco (storedName) não pode aparecer na resposta.
    expect(Object.keys(body).sort()).toEqual([
      "createdAt",
      "id",
      "mimeType",
      "originalName",
      "size",
      "uploadedBy",
    ])
    expect(body["originalName"]).toBe("captura.png")
    expect(body["mimeType"]).toBe("image/png")
    expect(body["size"]).toBe(png.length)
    expect(body["uploadedBy"]).toMatchObject({ id: analystId })

    const saved = await prisma.evidence.findUniqueOrThrow({
      where: { id: body["id"] as string },
    })
    expect(saved.storedName).toMatch(/^[0-9a-f-]{36}\.png$/)
    const onDisk: Buffer = await readFile(getStoredFilePath(saved.storedName))
    expect(onDisk.equals(png)).toBe(true)
  })

  it("o tipo vem do conteúdo, e não do nome nem do Content-Type enviados", async (): Promise<void> => {
    const textAsImage: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(makeText("anotações do teste"), "foto.png", "image/png"),
    )
    const imageAsText: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(makePng(), "notas.txt", "text/plain"),
    )
    const html: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(
        makeText("<script>alert(1)</script>"),
        "pagina.html",
        "text/html",
      ),
    )

    expect(textAsImage.status).toBe(201)
    expect(bodyOf(textAsImage)["mimeType"]).toBe("text/plain")
    expect(imageAsText.status).toBe(201)
    expect(bodyOf(imageAsText)["mimeType"]).toBe("image/png")
    // HTML nunca é guardado como HTML: vira texto puro.
    expect(html.status).toBe(201)
    expect(bodyOf(html)["mimeType"]).toBe("text/plain")
  })

  it("nome com acento é preservado, e nome com pasta vira só o nome do arquivo", async (): Promise<void> => {
    const accented: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(makeText("conteúdo"), "relatório final.txt", "text/plain"),
    )
    const traversal: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(makeText("conteúdo"), "../../etc/passwd.txt", "text/plain"),
    )

    expect(accented.status).toBe(201)
    expect(bodyOf(accented)["originalName"]).toBe("relatório final.txt")
    expect(traversal.status).toBe(201)
    expect(bodyOf(traversal)["originalName"]).toBe("passwd.txt")
  })

  it("um arquivo de exatamente 5 MB (o limite) é aceito", async (): Promise<void> => {
    const content: Buffer = Buffer.alloc(MAX_UPLOAD_BYTES, "a")

    const response: ApiResponse = await analyst.upload(
      evidenceUrl(findingId),
      fileForm(content, "limite.txt", "text/plain"),
    )

    expect(response.status).toBe(201)
    expect(bodyOf(response)["size"]).toBe(MAX_UPLOAD_BYTES)
  })
})

describe("envios recusados pelo conteúdo", (): void => {
  it('arquivo em outro campo que não seja "file": 400', async (): Promise<void> => {
    const response: ApiResponse = await analyst.upload(
      evidenceUrl(refusedFindingId),
      fileForm(makePng(), "captura.png", "image/png", "arquivo"),
    )

    expect(response.status).toBe(400)
    expect(errorOf(response)).toBe(
      'Upload inválido: envie um único arquivo no campo "file"',
    )
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })

  it("arquivo vazio: 400", async (): Promise<void> => {
    const response: ApiResponse = await analyst.upload(
      evidenceUrl(refusedFindingId),
      fileForm(Buffer.alloc(0), "vazio.txt", "text/plain"),
    )

    expect(response.status).toBe(400)
    expect(errorOf(response)).toBe('Envie um arquivo não vazio no campo "file"')
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })

  it("executável disfarçado de PNG: 415", async (): Promise<void> => {
    const response: ApiResponse = await analyst.upload(
      evidenceUrl(refusedFindingId),
      fileForm(makeExecutable(), "programa.png", "image/png"),
    )

    expect(response.status).toBe(415)
    expect(errorOf(response)).toContain("Tipo de arquivo não permitido")
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })

  it("arquivo 1 byte acima de 5 MB: 413", async (): Promise<void> => {
    const content: Buffer = Buffer.alloc(MAX_UPLOAD_BYTES + 1, "a")

    const response: ApiResponse = await analyst.upload(
      evidenceUrl(refusedFindingId),
      fileForm(content, "grande.txt", "text/plain"),
    )

    expect(response.status).toBe(413)
    expect(errorOf(response)).toBe("Arquivo grande demais (limite: 5 MB)")
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })
})

describe("limite de evidências por achado", (): void => {
  it("a 11ª evidência dá 409, e as 10 anteriores continuam", async (): Promise<void> => {
    const fullFindingId: string = await createFinding(analyst, projectId, {
      title: "Achado com o limite de evidências",
    })
    // As 10 entram direto no banco: não precisam de arquivo para este teste.
    await prisma.evidence.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        findingId: fullFindingId,
        uploadedById: analystId,
        storedName: `${randomUUID()}.txt`,
        originalName: `antiga-${index + 1}.txt`,
        mimeType: "text/plain",
        size: 5,
      })),
    })

    const response: ApiResponse = await analyst.upload(
      evidenceUrl(fullFindingId),
      fileForm(makePng(), "captura.png", "image/png"),
    )

    expect(response.status).toBe(409)
    expect(errorOf(response)).toBe(
      "Limite de 10 evidências por achado atingido",
    )
    expect(await countEvidence(fullFindingId)).toBe(10)
  })
})

describe("quem não pode enviar", (): void => {
  it("leitor (VIEWER) membro do projeto: 403, e nada é gravado", async (): Promise<void> => {
    const response: ApiResponse = await viewer.upload(
      evidenceUrl(refusedFindingId),
      fileForm(makePng(), "captura.png", "image/png"),
    )

    expect(response.status).toBe(403)
    expect(errorOf(response)).toBe("Sem permissão")
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })

  it("sem login: 401", async (): Promise<void> => {
    const response: ApiResponse = await anonymous.upload(
      evidenceUrl(refusedFindingId),
      fileForm(makePng(), "captura.png", "image/png"),
    )

    expect(response.status).toBe(401)
    expect(errorOf(response)).toBe("Não autenticado")
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })

  it("sem token CSRF ou com token falso: 403", async (): Promise<void> => {
    const missing: ApiResponse = await analyst.upload(
      evidenceUrl(refusedFindingId),
      fileForm(makePng(), "captura.png", "image/png"),
      false,
    )
    const forged: ApiResponse = await analyst.upload(
      evidenceUrl(refusedFindingId),
      fileForm(makePng(), "captura.png", "image/png"),
      "token-falso",
    )

    expect(missing.status).toBe(403)
    expect(errorOf(missing)).toBe("Token CSRF inválido ou ausente")
    expect(forged.status).toBe(403)
    expect(await countEvidence(refusedFindingId)).toBe(0)
  })
})
