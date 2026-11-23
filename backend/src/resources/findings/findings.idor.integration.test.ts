import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import {
  createAsset,
  createFinding,
  createProject,
  send,
  type Call,
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

// IDOR (referência direta e insegura a objeto): a Alice é membro só do projeto
// A, e o Bruno é dono do projeto B. Ela conhece os ids do B e tenta usá-los,
// seja na URL do projeto B, seja misturados na URL do projeto A.
let server: TestServer
let alice: TestClient
let bruno: TestClient
let aliceId: string
let brunoId: string

let projectA: string
let assetA: string
let findingA: string

let projectB: string
let assetB: string
let findingB: string
let evidenceB: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({ email: uniqueEmail("alice") })
  const brunoUser = await createUser({ email: uniqueEmail("bruno") })
  aliceId = aliceUser.id
  brunoId = brunoUser.id
  alice = await signIn(server.baseUrl, aliceUser.email)
  bruno = await signIn(server.baseUrl, brunoUser.email)

  projectA = await createProject(alice, "Projeto A")
  assetA = await createAsset(alice, projectA, "Site do A")
  findingA = await createFinding(alice, projectA, { title: "XSS no site do A" })

  projectB = await createProject(bruno, "Projeto B")
  assetB = await createAsset(bruno, projectB, "Site do B")
  findingB = await createFinding(bruno, projectB, {
    title: "SQL Injection no site do B",
    assetId: assetB,
  })

  // A evidência entra direto no banco: o teste não precisa de upload nem de
  // arquivo no disco, porque nenhuma das tentativas deve chegar até ele.
  const evidence = await prisma.evidence.create({
    data: {
      findingId: findingB,
      uploadedById: brunoId,
      storedName: `${randomUUID()}.txt`,
      originalName: "captura.txt",
      mimeType: "text/plain",
      size: 12,
    },
  })
  evidenceB = evidence.id
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

describe("controle: o dono do projeto B alcança os próprios dados", (): void => {
  it("lê o achado, o ativo e a evidência do B (as rotas funcionam)", async (): Promise<void> => {
    const reads: Call[] = [
      { method: "GET", path: `/projects/${projectB}/findings/${findingB}` },
      { method: "GET", path: `/projects/${projectB}/assets/${assetB}` },
      {
        method: "GET",
        path: `/projects/${projectB}/findings/${findingB}/evidence`,
      },
    ]

    for (const call of reads) {
      const response: ApiResponse = await send(bruno, call)
      expect(response.status, call.path).toBe(200)
    }
  })
})

describe("ids do projeto B usados dentro do projeto A", (): void => {
  it("achado do B: leitura, edição, status, histórico, evidências e exclusão dão 404", async (): Promise<void> => {
    const base = `/projects/${projectA}/findings/${findingB}`
    const calls: Call[] = [
      { method: "GET", path: base },
      { method: "PATCH", path: base, body: { title: "Título trocado" } },
      { method: "PATCH", path: `${base}/status`, body: { status: "FIXED" } },
      { method: "GET", path: `${base}/history` },
      { method: "GET", path: `${base}/evidence` },
      { method: "POST", path: `${base}/evidence`, body: {} },
      { method: "DELETE", path: base },
    ]

    for (const call of calls) {
      const response: ApiResponse = await send(alice, call)
      expect(response.status, `${call.method} ${call.path}`).toBe(404)
    }
  })

  it("o achado do B continua intacto", async (): Promise<void> => {
    const finding = await prisma.finding.findUniqueOrThrow({
      where: { id: findingB },
    })

    expect(finding.title).toBe("SQL Injection no site do B")
    expect(finding.status).toBe("OPEN")
    expect(finding.projectId).toBe(projectB)
    expect(
      await prisma.statusHistory.count({ where: { findingId: findingB } }),
    ).toBe(1)
  })

  it("evidência do B: baixar e excluir dão 404, pelo achado errado ou pelo projeto errado", async (): Promise<void> => {
    const calls: Call[] = [
      // Achado e evidência do B, dentro do projeto A.
      {
        method: "GET",
        path: `/projects/${projectA}/findings/${findingB}/evidence/${evidenceB}/download`,
      },
      {
        method: "DELETE",
        path: `/projects/${projectA}/findings/${findingB}/evidence/${evidenceB}`,
      },
      // Achado do A, com a evidência de outro achado.
      {
        method: "GET",
        path: `/projects/${projectA}/findings/${findingA}/evidence/${evidenceB}/download`,
      },
      {
        method: "DELETE",
        path: `/projects/${projectA}/findings/${findingA}/evidence/${evidenceB}`,
      },
    ]

    for (const call of calls) {
      const response: ApiResponse = await send(alice, call)
      expect(response.status, `${call.method} ${call.path}`).toBe(404)
    }

    expect(await prisma.evidence.count({ where: { id: evidenceB } })).toBe(1)
  })

  it("ativo do B: leitura, edição e exclusão dão 404, e o ativo continua intacto", async (): Promise<void> => {
    const base = `/projects/${projectA}/assets/${assetB}`
    const calls: Call[] = [
      { method: "GET", path: base },
      { method: "PATCH", path: base, body: { name: "Ativo trocado" } },
      { method: "DELETE", path: base },
    ]

    for (const call of calls) {
      const response: ApiResponse = await send(alice, call)
      expect(response.status, `${call.method} ${call.path}`).toBe(404)
    }

    const asset = await prisma.asset.findUniqueOrThrow({
      where: { id: assetB },
    })
    expect(asset.name).toBe("Site do B")
    expect(asset.projectId).toBe(projectB)
  })

  it("a lista de achados do A não vaza nada do B, nem filtrando pelo ativo do B", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "GET",
      `/projects/${projectA}/findings?assetId=${assetB}`,
    )

    expect(response.status).toBe(200)
    expect(bodyOf(response)["data"]).toEqual([])
    expect(JSON.stringify(response.body)).not.toContain(findingB)
  })
})

describe("o projeto B direto, sem ser membro", (): void => {
  it("todas as rotas dão 404 com a mesma mensagem de um projeto que não existe", async (): Promise<void> => {
    const calls: Call[] = [
      { method: "GET", path: `/projects/${projectB}` },
      { method: "GET", path: `/projects/${projectB}/findings` },
      { method: "GET", path: `/projects/${projectB}/findings/${findingB}` },
      { method: "GET", path: `/projects/${projectB}/assets/${assetB}` },
      {
        method: "DELETE",
        path: `/projects/${projectB}/findings/${findingB}/evidence/${evidenceB}`,
      },
    ]

    for (const call of calls) {
      const response: ApiResponse = await send(alice, call)
      expect(response.status, `${call.method} ${call.path}`).toBe(404)
      expect(bodyOf(response)["error"], call.path).toBe(
        "Projeto não encontrado",
      )
    }
  })
})

describe("ligar um achado do A a coisas do B", (): void => {
  const newFinding = {
    title: "Falha de configuração",
    description: "O servidor expõe a versão do software nos cabeçalhos.",
    severity: "LOW",
  }

  function detailFields(response: ApiResponse): unknown[] {
    const details = bodyOf(response)["details"] as Array<{ field: string }>
    return details.map((detail): string => detail.field)
  }

  it("criar achado com o ativo do B dá 400", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "POST",
      `/projects/${projectA}/findings`,
      { body: { ...newFinding, assetId: assetB }, csrf: true },
    )

    expect(response.status).toBe(400)
    expect(detailFields(response)).toEqual(["assetId"])
  })

  it("criar achado com um responsável que não é membro do A dá 400", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "POST",
      `/projects/${projectA}/findings`,
      { body: { ...newFinding, assigneeId: brunoId }, csrf: true },
    )

    expect(response.status).toBe(400)
    expect(detailFields(response)).toEqual(["assigneeId"])
  })

  it("trocar o ativo de um achado do A pelo ativo do B dá 400, e nada muda", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "PATCH",
      `/projects/${projectA}/findings/${findingA}`,
      { body: { assetId: assetB }, csrf: true },
    )

    const finding = await prisma.finding.findUniqueOrThrow({
      where: { id: findingA },
    })
    expect(response.status).toBe(400)
    expect(finding.assetId).toBeNull()
  })

  it("a consulta de duplicatas com o ativo do B dá 400", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "GET",
      `/projects/${projectA}/findings/duplicates?title=${encodeURIComponent(
        "SQL Injection no site do B",
      )}&assetId=${assetB}`,
    )

    expect(response.status).toBe(400)
  })

  it("nenhuma dessas tentativas criou achado no A", async (): Promise<void> => {
    expect(await prisma.finding.count({ where: { projectId: projectA } })).toBe(
      1,
    )
  })

  it("controle: com o ativo e o responsável do próprio projeto A, o achado é criado", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "POST",
      `/projects/${projectA}/findings`,
      {
        body: { ...newFinding, assetId: assetA, assigneeId: aliceId },
        csrf: true,
      },
    )

    expect(response.status).toBe(201)
  })
})

describe("campos que o cliente não pode escolher (mass assignment)", (): void => {
  it("criar achado ignora status, quem registrou, projeto e id enviados", async (): Promise<void> => {
    const forgedId: string = randomUUID()
    const response: ApiResponse = await alice.request(
      "POST",
      `/projects/${projectA}/findings`,
      {
        body: {
          title: "Achado com campos forjados",
          description: "Tentativa de escolher status, projeto e autor.",
          severity: "MEDIUM",
          id: forgedId,
          status: "VERIFIED",
          reporterId: brunoId,
          projectId: projectB,
        },
        csrf: true,
      },
    )

    expect(response.status).toBe(201)
    const createdId = bodyOf(response)["id"] as string
    const saved = await prisma.finding.findUniqueOrThrow({
      where: { id: createdId },
    })

    expect(createdId).not.toBe(forgedId)
    expect(saved.status).toBe("OPEN")
    expect(saved.reporterId).toBe(aliceId)
    expect(saved.projectId).toBe(projectA)
  })

  it("editar achado só com o status dá 400: o status muda só pela rota própria", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "PATCH",
      `/projects/${projectA}/findings/${findingA}`,
      { body: { status: "FIXED" }, csrf: true },
    )

    const finding = await prisma.finding.findUniqueOrThrow({
      where: { id: findingA },
    })
    expect(response.status).toBe(400)
    expect(finding.status).toBe("OPEN")
  })

  it("editar achado ignora status, quem registrou e projeto, e aplica só o título", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "PATCH",
      `/projects/${projectA}/findings/${findingA}`,
      {
        body: {
          title: "XSS refletido no site do A",
          status: "VERIFIED",
          reporterId: brunoId,
          projectId: projectB,
        },
        csrf: true,
      },
    )

    const finding = await prisma.finding.findUniqueOrThrow({
      where: { id: findingA },
    })
    expect(response.status).toBe(200)
    expect(finding.title).toBe("XSS refletido no site do A")
    expect(finding.status).toBe("OPEN")
    expect(finding.reporterId).toBe(aliceId)
    expect(finding.projectId).toBe(projectA)
  })

  it("criar projeto ignora o dono enviado: o dono é quem está logado", async (): Promise<void> => {
    const response: ApiResponse = await alice.request("POST", "/projects", {
      body: { name: "Projeto com dono forjado", ownerId: brunoId },
      csrf: true,
    })

    expect(response.status).toBe(201)
    expect(bodyOf(response)["ownerId"]).toBe(aliceId)
  })

  it("criar ativo ignora o projeto enviado: o ativo nasce no projeto da URL", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "POST",
      `/projects/${projectA}/assets`,
      {
        body: { name: "Ativo forjado", type: "WEB", projectId: projectB },
        csrf: true,
      },
    )

    expect(response.status).toBe(201)
    const saved = await prisma.asset.findUniqueOrThrow({
      where: { id: bodyOf(response)["id"] as string },
    })
    expect(saved.projectId).toBe(projectA)
    expect(await prisma.asset.count({ where: { projectId: projectB } })).toBe(1)
  })
})
