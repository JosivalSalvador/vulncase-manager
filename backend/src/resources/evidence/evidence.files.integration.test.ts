import { randomUUID } from "node:crypto"
import { access, rm } from "node:fs/promises"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import type { Role } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { getStoredFilePath, saveFile } from "../../lib/storage.js"
import { fileForm, makePng, makeText } from "../../test/files.js"
import {
  addMember,
  createFinding,
  createProject,
  errorOf,
  send,
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
  type DownloadResponse,
  type TestServer,
} from "../../test/helpers.js"

// Listar, baixar e excluir evidências, e a limpeza dos arquivos no disco.
// Papéis: o dono do projeto, o autor (quem envia) e o colega são ANALYST; o
// leitor é VIEWER; o ADMIN não é membro do projeto.
interface Actor {
  id: string
  email: string
  client: TestClient
}

interface StoredEvidence {
  id: string
  storedName: string
}

interface DeleteAttempt {
  response: ApiResponse
  evidence: StoredEvidence
}

let server: TestServer
let anonymous: TestClient
let owner: Actor
let uploader: Actor
let colleague: Actor
let viewer: Actor
let admin: Actor

let projectId: string
// Cada grupo de testes usa o seu achado (o limite é de 10 evidências por achado).
let downloadFindingId: string
let otherFindingId: string
let deleteFindingId: string

// A evidência que os testes de leitura compartilham.
let sharedPng: Buffer
let shared: StoredEvidence

function evidenceUrl(finding: string): string {
  return `/projects/${projectId}/findings/${finding}/evidence`
}

function itemUrl(finding: string, evidenceId: string): string {
  return `${evidenceUrl(finding)}/${evidenceId}`
}

function downloadUrl(finding: string, evidenceId: string): string {
  return `${itemUrl(finding, evidenceId)}/download`
}

async function newActor(role: Role, label: string): Promise<Actor> {
  const user = await createUser({ role, email: uniqueEmail(label) })
  return {
    id: user.id,
    email: user.email,
    client: await signIn(server.baseUrl, user.email),
  }
}

// Envia pela API (com sessão e CSRF) e devolve o id e o nome gravado no disco.
async function sendEvidence(
  client: TestClient,
  finding: string,
  content: Buffer = makePng(),
  filename = "captura.png",
  contentType = "image/png",
): Promise<StoredEvidence> {
  const response: ApiResponse = await client.upload(
    evidenceUrl(finding),
    fileForm(content, filename, contentType),
  )
  const id: unknown = response.status === 201 ? bodyOf(response)["id"] : null
  if (typeof id !== "string") {
    throw new Error(
      `Não consegui enviar a evidência no teste: ${response.status} ` +
        JSON.stringify(response.body),
    )
  }

  const saved = await prisma.evidence.findUniqueOrThrow({
    where: { id },
    select: { storedName: true },
  })
  return { id, storedName: saved.storedName }
}

// Cria a evidência direto (arquivo no disco e registro), para os testes que
// não são sobre o envio. O dono do projeto consta como quem enviou.
async function seedEvidence(finding: string): Promise<StoredEvidence> {
  const content: Buffer = makeText("conteúdo de teste")
  const storedName: string = await saveFile(content, "txt")
  const saved = await prisma.evidence.create({
    data: {
      findingId: finding,
      uploadedById: owner.id,
      storedName,
      originalName: "log.txt",
      mimeType: "text/plain",
      size: content.length,
    },
    select: { id: true },
  })
  return { id: saved.id, storedName }
}

async function existsOnDisk(storedName: string): Promise<boolean> {
  try {
    await access(getStoredFilePath(storedName))
    return true
  } catch {
    return false
  }
}

async function expectGone(evidence: StoredEvidence): Promise<void> {
  expect(await prisma.evidence.count({ where: { id: evidence.id } })).toBe(0)
  expect(await existsOnDisk(evidence.storedName)).toBe(false)
}

async function expectStillThere(evidence: StoredEvidence): Promise<void> {
  expect(await prisma.evidence.count({ where: { id: evidence.id } })).toBe(1)
  expect(await existsOnDisk(evidence.storedName)).toBe(true)
}

// A mensagem de erro de uma resposta do download (o corpo chega como bytes).
function errorOfDownload(response: DownloadResponse): unknown {
  const body = JSON.parse(response.bytes.toString("utf8")) as Record<
    string,
    unknown
  >
  return body["error"]
}

// O autor envia uma evidência nova, e o cliente indicado tenta excluí-la.
async function deleteAs(client: TestClient): Promise<DeleteAttempt> {
  const evidence = await sendEvidence(uploader.client, deleteFindingId)
  const response: ApiResponse = await send(client, {
    method: "DELETE",
    path: itemUrl(deleteFindingId, evidence.id),
  })
  return { response, evidence }
}

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  anonymous = new TestClient(server.baseUrl)
  await anonymous.refreshCsrf()

  owner = await newActor("ANALYST", "dono")
  uploader = await newActor("ANALYST", "autor")
  colleague = await newActor("ANALYST", "colega")
  viewer = await newActor("VIEWER", "leitor")
  admin = await newActor("ADMIN", "admin")

  projectId = await createProject(owner.client, "Projeto de arquivos")
  for (const member of [uploader, colleague, viewer]) {
    await addMember(owner.client, projectId, member.email)
  }

  downloadFindingId = await createFinding(owner.client, projectId, {
    title: "Achado dos downloads",
  })
  otherFindingId = await createFinding(owner.client, projectId, {
    title: "Outro achado do mesmo projeto",
  })
  deleteFindingId = await createFinding(owner.client, projectId, {
    title: "Achado das exclusões",
  })

  sharedPng = makePng()
  shared = await sendEvidence(
    uploader.client,
    downloadFindingId,
    sharedPng,
    "captura de tela.png",
    "image/png",
  )
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

describe("listar e baixar", (): void => {
  it("o leitor (VIEWER) lista e baixa, e a lista não mostra o nome gravado no disco", async (): Promise<void> => {
    const list: ApiResponse = await viewer.client.request(
      "GET",
      evidenceUrl(downloadFindingId),
    )

    expect(list.status).toBe(200)
    const items = bodyOf(list)["data"] as Array<Record<string, unknown>>
    expect(items.map((item) => item["id"])).toContain(shared.id)
    expect(JSON.stringify(list.body)).not.toContain(shared.storedName)

    const file: DownloadResponse = await viewer.client.download(
      downloadUrl(downloadFindingId, shared.id),
    )
    expect(file.status).toBe(200)
    expect(file.bytes.equals(sharedPng)).toBe(true)
  })

  it("o download devolve o tipo do conteúdo, como anexo e com os cabeçalhos de proteção", async (): Promise<void> => {
    const file: DownloadResponse = await uploader.client.download(
      downloadUrl(downloadFindingId, shared.id),
    )

    expect(file.status).toBe(200)
    expect(file.headers.get("content-type")).toMatch(/^image\/png/)
    expect(file.headers.get("content-disposition")).toMatch(/^attachment;/)
    expect(file.headers.get("content-disposition")).toContain(
      "captura de tela.png",
    )
    expect(file.headers.get("cache-control")).toBe("private, no-store")
    expect(file.headers.get("cross-origin-resource-policy")).toBe("same-site")
    expect(file.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("um HTML enviado é baixado como texto puro, em anexo", async (): Promise<void> => {
    const html: Buffer = makeText("<script>alert(1)</script>")
    const sent: StoredEvidence = await sendEvidence(
      uploader.client,
      downloadFindingId,
      html,
      "pagina.html",
      "text/html",
    )

    const file: DownloadResponse = await uploader.client.download(
      downloadUrl(downloadFindingId, sent.id),
    )

    expect(file.status).toBe(200)
    expect(file.headers.get("content-type")).toMatch(/^text\/plain/)
    expect(file.headers.get("content-disposition")).toMatch(/^attachment;/)
    expect(file.headers.get("x-content-type-options")).toBe("nosniff")
    expect(file.bytes.equals(html)).toBe(true)
  })

  it("o ADMIN, mesmo sem ser membro do projeto, lista e baixa", async (): Promise<void> => {
    const list: ApiResponse = await admin.client.request(
      "GET",
      evidenceUrl(downloadFindingId),
    )
    const file: DownloadResponse = await admin.client.download(
      downloadUrl(downloadFindingId, shared.id),
    )

    expect(list.status).toBe(200)
    expect(file.status).toBe(200)
    expect(file.bytes.equals(sharedPng)).toBe(true)
  })

  it("sem login: 401 ao listar e ao baixar", async (): Promise<void> => {
    const list: ApiResponse = await anonymous.request(
      "GET",
      evidenceUrl(downloadFindingId),
    )
    const file: DownloadResponse = await anonymous.download(
      downloadUrl(downloadFindingId, shared.id),
    )

    expect(list.status).toBe(401)
    expect(file.status).toBe(401)
    expect(errorOfDownload(file)).toBe("Não autenticado")
  })

  it("a evidência pedida pelo achado errado (do mesmo projeto) dá 404", async (): Promise<void> => {
    const file: DownloadResponse = await uploader.client.download(
      downloadUrl(otherFindingId, shared.id),
    )

    expect(file.status).toBe(404)
    expect(errorOfDownload(file)).toBe("Evidência não encontrada")
  })

  it("id que não é UUID dá 400, e UUID que não existe dá 404", async (): Promise<void> => {
    const notUuid: DownloadResponse = await uploader.client.download(
      downloadUrl(downloadFindingId, "nao-e-um-uuid"),
    )
    const missing: DownloadResponse = await uploader.client.download(
      downloadUrl(downloadFindingId, randomUUID()),
    )

    expect(notUuid.status).toBe(400)
    expect(errorOfDownload(notUuid)).toBe("Dados inválidos")
    expect(missing.status).toBe(404)
    expect(errorOfDownload(missing)).toBe("Evidência não encontrada")
  })

  describe("arquivo que sumiu do disco", (): void => {
    let lost: StoredEvidence

    beforeAll(async (): Promise<void> => {
      lost = await sendEvidence(uploader.client, downloadFindingId)
      await rm(getStoredFilePath(lost.storedName))
    })

    it("404 com mensagem clara, sem o cabeçalho de download, e o registro continua", async (): Promise<void> => {
      const file: DownloadResponse = await uploader.client.download(
        downloadUrl(downloadFindingId, lost.id),
      )

      expect(file.status).toBe(404)
      expect(errorOfDownload(file)).toBe("Arquivo não encontrado")
      expect(file.headers.get("content-disposition")).toBeNull()
      expect(await prisma.evidence.count({ where: { id: lost.id } })).toBe(1)
    })

    it("a resposta de erro volta como JSON, sem herdar o tipo do arquivo", async (): Promise<void> => {
      const file: DownloadResponse = await uploader.client.download(
        downloadUrl(downloadFindingId, lost.id),
      )

      expect(file.status).toBe(404)
      expect(file.headers.get("content-type")).toMatch(/^application\/json/)
    })
  })
})

describe("excluir", (): void => {
  it("quem enviou exclui a própria: 204, o registro e o arquivo somem, e repetir dá 404", async (): Promise<void> => {
    const { response, evidence } = await deleteAs(uploader.client)

    expect(response.status).toBe(204)
    await expectGone(evidence)

    const again: ApiResponse = await send(uploader.client, {
      method: "DELETE",
      path: itemUrl(deleteFindingId, evidence.id),
    })
    expect(again.status).toBe(404)
    expect(errorOf(again)).toBe("Evidência não encontrada")
  })

  it("o dono do projeto exclui a evidência enviada por outra pessoa", async (): Promise<void> => {
    const { response, evidence } = await deleteAs(owner.client)

    expect(response.status).toBe(204)
    await expectGone(evidence)
  })

  it("o ADMIN, mesmo sem ser membro, exclui a evidência de outra pessoa", async (): Promise<void> => {
    const { response, evidence } = await deleteAs(admin.client)

    expect(response.status).toBe(204)
    await expectGone(evidence)
  })

  it("o colega analista (não é o autor nem o dono) recebe 403, e nada é apagado", async (): Promise<void> => {
    const { response, evidence } = await deleteAs(colleague.client)

    expect(response.status).toBe(403)
    expect(errorOf(response)).toBe(
      "Só quem enviou a evidência, o dono do projeto ou um ADMIN pode excluí-la",
    )
    await expectStillThere(evidence)
  })

  it("o leitor (VIEWER) recebe 403, e nada é apagado", async (): Promise<void> => {
    const { response, evidence } = await deleteAs(viewer.client)

    expect(response.status).toBe(403)
    expect(errorOf(response)).toBe("Sem permissão")
    await expectStillThere(evidence)
  })

  it("sem login: 401, e nada é apagado", async (): Promise<void> => {
    const { response, evidence } = await deleteAs(anonymous)

    expect(response.status).toBe(401)
    expect(errorOf(response)).toBe("Não autenticado")
    await expectStillThere(evidence)
  })
})

describe("limpeza dos arquivos no disco", (): void => {
  it("excluir o achado apaga os arquivos dele, e só os dele", async (): Promise<void> => {
    const finding: string = await createFinding(owner.client, projectId, {
      title: "Achado que será excluído",
    })
    const first: StoredEvidence = await seedEvidence(finding)
    const second: StoredEvidence = await seedEvidence(finding)
    const keeper: StoredEvidence = await seedEvidence(otherFindingId)

    const response: ApiResponse = await send(owner.client, {
      method: "DELETE",
      path: `/projects/${projectId}/findings/${finding}`,
    })

    expect(response.status).toBe(204)
    await expectGone(first)
    await expectGone(second)
    await expectStillThere(keeper)
  })

  it("excluir o projeto apaga os arquivos de todos os achados dele", async (): Promise<void> => {
    const project: string = await createProject(
      owner.client,
      "Projeto que será excluído",
    )
    const firstFinding: string = await createFinding(owner.client, project, {
      title: "Primeiro achado",
    })
    const secondFinding: string = await createFinding(owner.client, project, {
      title: "Segundo achado",
    })
    const first: StoredEvidence = await seedEvidence(firstFinding)
    const second: StoredEvidence = await seedEvidence(secondFinding)

    const response: ApiResponse = await send(owner.client, {
      method: "DELETE",
      path: `/projects/${project}`,
    })

    expect(response.status).toBe(204)
    await expectGone(first)
    await expectGone(second)
  })
})
