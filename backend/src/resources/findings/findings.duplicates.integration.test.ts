import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import type { FindingStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { addMember, createAsset, createProject } from "../../test/fixtures.js"
import {
  bodyOf,
  cleanupTestUsers,
  createUser,
  signIn,
  startServer,
  uniqueEmail,
  type ApiResponse,
  type TestClient,
  type TestServer,
} from "../../test/helpers.js"

interface DuplicateItem {
  finding: Record<string, unknown>
  similarity: number
  reasons: string[]
}

interface FindingBody {
  title: string
  assetId?: string
  cwe?: string
  cve?: string
}

let server: TestServer
let alice: TestClient
let viewer: TestClient
let outsider: TestClient
let projectId: string
let otherProjectId: string

// Um ativo por cenário, para os testes não se atrapalharem.
let assetA: string // XSS, rate limit, lodash e um achado já corrigido
let assetB: string // mesmo título do XSS do ativo A
let assetD: string // sete achados iguais (o limite é cinco)
let assetE: string // ordem por parecença
let assetF: string // aviso ao criar
let otherAsset: string // ativo de outro projeto

let xssId: string
let xssOtherAssetId: string
let xssNoAssetId: string
let lodashId: string
let exactId: string
let looseId: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({ email: uniqueEmail("alice") })
  const viewerUser = await createUser({
    email: uniqueEmail("leitor"),
    role: "VIEWER",
  })
  const outsiderUser = await createUser({ email: uniqueEmail("fora") })
  alice = await signIn(server.baseUrl, aliceUser.email)
  viewer = await signIn(server.baseUrl, viewerUser.email)
  outsider = await signIn(server.baseUrl, outsiderUser.email)

  projectId = await createProject(alice, "Duplicatas - projeto principal")
  otherProjectId = await createProject(alice, "Duplicatas - outro projeto")
  await addMember(alice, projectId, viewerUser.email)

  assetA = await createAsset(alice, projectId, "Portal web")
  assetB = await createAsset(alice, projectId, "Aplicativo móvel")
  assetD = await createAsset(alice, projectId, "Painel administrativo")
  assetE = await createAsset(alice, projectId, "Servidor de sessões")
  assetF = await createAsset(alice, projectId, "Servidor de arquivos")
  otherAsset = await createAsset(
    alice,
    otherProjectId,
    "Ativo de outro projeto",
  )

  // Ativo A: é o que a consulta compara na maior parte dos testes.
  xssId = await add({
    title: "XSS refletido na busca",
    assetId: assetA,
    cwe: "CWE-79",
  })
  await add({ title: "Falta de rate limit no login", assetId: assetA })
  lodashId = await add({
    title: "Pacote lodash vulnerável",
    assetId: assetA,
    cve: "CVE-2021-23337",
  })
  const fixedId = await add({
    title: "SQL Injection no login",
    assetId: assetA,
    cwe: "CWE-89",
  })
  await walk(fixedId, ["IN_PROGRESS", "FIXED"])

  // O mesmo título em outros lugares: outro ativo, sem ativo e outro projeto.
  xssOtherAssetId = await add({
    title: "XSS refletido na busca",
    assetId: assetB,
  })
  xssNoAssetId = await add({ title: "XSS refletido na busca" })
  await add(
    { title: "XSS refletido na busca", assetId: otherAsset },
    otherProjectId,
  )
  await add({ title: "XSS refletido na busca" }, otherProjectId)

  for (let index = 0; index < 7; index += 1) {
    await add({ title: "Senha fraca no painel", assetId: assetD })
  }

  // O achado parecido é criado depois do exato, então o mais novo não é o
  // mais parecido.
  exactId = await add({
    title: "Cookie de sessão sem flag Secure",
    assetId: assetE,
  })
  looseId = await add({
    title: "Cookie de sessão sem Secure e HttpOnly",
    assetId: assetE,
  })
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

function create(
  body: FindingBody,
  project: string = projectId,
): Promise<ApiResponse> {
  return alice.request("POST", `/projects/${project}/findings`, {
    body: {
      description: "Achado criado para o teste de duplicatas.",
      severity: "HIGH",
      ...body,
    },
    csrf: true,
  })
}

async function add(
  body: FindingBody,
  project: string = projectId,
): Promise<string> {
  const response: ApiResponse = await create(body, project)
  const id: unknown = response.status === 201 ? bodyOf(response)["id"] : null
  if (typeof id !== "string") {
    throw new Error(
      `Não consegui criar "${body.title}" no teste: ${response.status} ` +
        JSON.stringify(response.body),
    )
  }
  return id
}

async function walk(
  findingId: string,
  statuses: FindingStatus[],
): Promise<void> {
  for (const status of statuses) {
    const response: ApiResponse = await alice.request(
      "PATCH",
      `/projects/${projectId}/findings/${findingId}/status`,
      { body: { status }, csrf: true },
    )
    if (response.status !== 200) {
      throw new Error(
        `Não consegui mudar para ${status} no teste: ${response.status} ` +
          JSON.stringify(response.body),
      )
    }
  }
}

function searchPath(
  params: Record<string, string>,
  project: string = projectId,
): string {
  const query: string = new URLSearchParams(params).toString()
  return `/projects/${project}/findings/duplicates?${query}`
}

async function duplicatesOf(
  params: Record<string, string>,
): Promise<DuplicateItem[]> {
  const response: ApiResponse = await alice.request("GET", searchPath(params))
  expect(response.status).toBe(200)
  return bodyOf(response)["data"] as DuplicateItem[]
}

function idsOf(items: DuplicateItem[]): unknown[] {
  return items.map((item): unknown => item.finding["id"])
}

describe("GET /projects/:id/findings/duplicates", (): void => {
  it("acha o achado de mesmo título no mesmo ativo, sem expor a descrição", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "XSS refletido na busca",
      assetId: assetA,
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.finding).toMatchObject({
      id: xssId,
      title: "XSS refletido na busca",
      severity: "HIGH",
      status: "OPEN",
      cwe: "CWE-79",
    })
    expect(items[0]?.finding).not.toHaveProperty("description")
    expect(items[0]?.similarity).toBe(1)
    expect(items[0]?.reasons).toEqual(["Título parecido"])
  })

  it("só compara dentro do mesmo ativo e do mesmo projeto", async (): Promise<void> => {
    const other = await duplicatesOf({
      title: "XSS refletido na busca",
      assetId: assetB,
    })
    expect(idsOf(other)).toEqual([xssOtherAssetId])

    // Sem ativo, compara só com os que também não têm. O achado sem ativo do
    // outro projeto, com o mesmo título, não pode aparecer.
    const none = await duplicatesOf({ title: "XSS refletido na busca" })
    expect(idsOf(none)).toEqual([xssNoAssetId])
  })

  it("acha títulos parecidos, mesmo com palavras diferentes", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "XSS refletido no campo de busca",
      assetId: assetA,
    })

    expect(idsOf(items)).toEqual([xssId])
    expect(items[0]?.similarity).toBe(0.75)
  })

  it("com o mesmo CWE, aceita um título menos parecido", async (): Promise<void> => {
    const params = { title: "Reflexão de XSS na busca", assetId: assetA }

    const withCwe = await duplicatesOf({ ...params, cwe: "CWE-79" })
    expect(idsOf(withCwe)).toEqual([xssId])
    expect(withCwe[0]?.similarity).toBe(0.5)
    expect(withCwe[0]?.reasons).toEqual(["Mesmo CWE", "Título parecido"])

    // O mesmo título, sem o CWE, não é parecido o bastante.
    expect(await duplicatesOf(params)).toEqual([])
  })

  it("só o mesmo CWE não basta: o título precisa ter algo em comum", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "Cabeçalho de segurança ausente",
      assetId: assetA,
      cwe: "CWE-79",
    })

    expect(items).toEqual([])
  })

  it("o mesmo CVE basta, mesmo com o título diferente", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "Biblioteca desatualizada",
      assetId: assetA,
      cve: "CVE-2021-23337",
    })

    expect(idsOf(items)).toEqual([lodashId])
    expect(items[0]?.similarity).toBe(0)
    expect(items[0]?.reasons).toEqual(["Mesmo CVE"])
  })

  it("não considera achados já corrigidos (reaparecer é regressão)", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "SQL Injection no login",
      assetId: assetA,
      cwe: "CWE-89",
    })

    expect(items).toEqual([])
  })

  it("devolve no máximo cinco", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "Senha fraca no painel",
      assetId: assetD,
    })

    expect(items).toHaveLength(5)
    for (const item of items) {
      expect(item.similarity).toBe(1)
    }
  })

  it("ordena do mais parecido ao menos parecido, e não do mais novo", async (): Promise<void> => {
    const items = await duplicatesOf({
      title: "Cookie de sessão sem flag Secure",
      assetId: assetE,
    })

    expect(idsOf(items)).toEqual([exactId, looseId])
    expect(items.map((item): number => item.similarity)).toEqual([1, 0.6])
  })

  it("recusa um ativo que é de outro projeto", async (): Promise<void> => {
    const response: ApiResponse = await alice.request(
      "GET",
      searchPath({ title: "XSS refletido na busca", assetId: otherAsset }),
    )

    expect(response.status).toBe(400)
    expect(bodyOf(response)["details"]).toEqual([
      { field: "assetId", message: "Ativo não encontrado neste projeto" },
    ])
  })

  it("recusa consulta inválida", async (): Promise<void> => {
    const queries: string[] = [
      "",
      "title=ab",
      "title=XSS+refletido&cwe=89",
      "title=XSS+refletido&cve=2021-1",
      "title=XSS+refletido&assetId=nao-e-um-uuid",
    ]

    for (const query of queries) {
      const response: ApiResponse = await alice.request(
        "GET",
        `/projects/${projectId}/findings/duplicates?${query}`,
      )
      expect(response.status, query || "sem parâmetros").toBe(400)
    }
  })

  it("o VIEWER consulta (é só leitura) e quem não participa recebe 404", async (): Promise<void> => {
    const path: string = searchPath({
      title: "XSS refletido na busca",
      assetId: assetA,
    })

    const asViewer: ApiResponse = await viewer.request("GET", path)
    expect(asViewer.status).toBe(200)

    const asOutsider: ApiResponse = await outsider.request("GET", path)
    expect(asOutsider.status).toBe(404)
  })
})

describe("aviso ao criar um achado", (): void => {
  it("um achado parecido é criado do mesmo jeito (201) e vem com o aviso", async (): Promise<void> => {
    const seedId: string = await add({
      title: "Backup exposto no servidor",
      assetId: assetF,
    })

    const response: ApiResponse = await create({
      title: "Backup exposto no servidor",
      assetId: assetF,
    })

    expect(response.status).toBe(201)
    const body = bodyOf(response)
    const possible = body["possibleDuplicates"] as DuplicateItem[]
    expect(idsOf(possible)).toEqual([seedId])
    expect(possible[0]?.similarity).toBe(1)

    // O achado novo existe, e não aparece como duplicata de si mesmo.
    expect(idsOf(possible)).not.toContain(body["id"])
    const created: ApiResponse = await alice.request(
      "GET",
      `/projects/${projectId}/findings/${String(body["id"])}`,
    )
    expect(created.status).toBe(200)
  })

  it("sem nenhum parecido, o aviso vem vazio", async (): Promise<void> => {
    const response: ApiResponse = await create({
      title: "Certificado TLS expirado",
      assetId: assetF,
    })

    expect(response.status).toBe(201)
    expect(bodyOf(response)["possibleDuplicates"]).toEqual([])
  })
})
