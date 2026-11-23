import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import type { FindingStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { addMember, createFinding, createProject } from "../../test/fixtures.js"
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

let server: TestServer
let alice: TestClient
let bruno: TestClient
let aliceId: string
let brunoId: string
let projectId: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({ email: uniqueEmail("alice") })
  const brunoUser = await createUser({ email: uniqueEmail("bruno") })
  aliceId = aliceUser.id
  brunoId = brunoUser.id
  alice = await signIn(server.baseUrl, aliceUser.email)
  bruno = await signIn(server.baseUrl, brunoUser.email)

  // A Alice é dona do projeto e o Bruno é um analista membro dele.
  projectId = await createProject(alice, "Projeto do histórico de status")
  await addMember(alice, projectId, brunoUser.email)
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

function changeStatus(
  client: TestClient,
  findingId: string,
  body: unknown,
): Promise<ApiResponse> {
  return client.request(
    "PATCH",
    `/projects/${projectId}/findings/${findingId}/status`,
    { body, csrf: true },
  )
}

// Aplica uma sequência de status, parando se alguma mudança for recusada.
async function walk(
  client: TestClient,
  findingId: string,
  statuses: FindingStatus[],
): Promise<void> {
  for (const status of statuses) {
    const response: ApiResponse = await changeStatus(client, findingId, {
      status,
    })
    if (response.status !== 200) {
      throw new Error(
        `Não consegui mudar para ${status} no teste: ${response.status} ` +
          JSON.stringify(response.body),
      )
    }
  }
}

interface HistoryItem {
  fromStatus: FindingStatus | null
  toStatus: FindingStatus
  changedBy: Record<string, unknown>
}

async function readHistory(
  client: TestClient,
  findingId: string,
  query = "",
): Promise<{ items: HistoryItem[]; meta: Record<string, unknown> }> {
  const response: ApiResponse = await client.request(
    "GET",
    `/projects/${projectId}/findings/${findingId}/history${query}`,
  )
  expect(response.status).toBe(200)
  const body: Record<string, unknown> = bodyOf(response)
  return {
    items: body["data"] as HistoryItem[],
    meta: body["meta"] as Record<string, unknown>,
  }
}

describe("histórico de status", (): void => {
  it("nasce com a criação do achado (de nada para OPEN)", async (): Promise<void> => {
    const findingId: string = await createFinding(alice, projectId, {
      title: "Achado com histórico novo",
    })

    const { items, meta } = await readHistory(alice, findingId)

    expect(items).toHaveLength(1)
    expect(items[0]?.fromStatus).toBeNull()
    expect(items[0]?.toStatus).toBe("OPEN")
    expect(items[0]?.changedBy["id"]).toBe(aliceId)
    expect(meta["total"]).toBe(1)
  })

  it("registra o caminho completo, na ordem em que aconteceu", async (): Promise<void> => {
    const findingId: string = await createFinding(alice, projectId, {
      title: "Achado do caminho completo",
    })

    await walk(alice, findingId, ["IN_PROGRESS", "FIXED", "VERIFIED", "OPEN"])

    const { items } = await readHistory(alice, findingId)
    expect(
      items.map((item: HistoryItem): [FindingStatus | null, FindingStatus] => [
        item.fromStatus,
        item.toStatus,
      ]),
    ).toEqual([
      [null, "OPEN"],
      ["OPEN", "IN_PROGRESS"],
      ["IN_PROGRESS", "FIXED"],
      ["FIXED", "VERIFIED"],
      ["VERIFIED", "OPEN"],
    ])
  })

  it("guarda quem mudou cada status, sem expor dados a mais do usuário", async (): Promise<void> => {
    const findingId: string = await createFinding(alice, projectId, {
      title: "Achado com dois analistas",
    })

    await walk(bruno, findingId, ["IN_PROGRESS"])
    await walk(alice, findingId, ["FIXED"])

    const { items } = await readHistory(bruno, findingId)
    expect(
      items.map((item: HistoryItem): unknown => item.changedBy["id"]),
    ).toEqual([aliceId, brunoId, aliceId])

    // Só id e nome: nada de e-mail, senha ou papel.
    for (const item of items) {
      expect(Object.keys(item.changedBy).sort()).toEqual(["fullname", "id"])
    }
  })

  it("pagina o histórico", async (): Promise<void> => {
    const findingId: string = await createFinding(alice, projectId, {
      title: "Achado com histórico paginado",
    })
    await walk(alice, findingId, ["IN_PROGRESS", "FIXED", "VERIFIED", "OPEN"])

    const first = await readHistory(alice, findingId, "?pageSize=2")
    expect(first.items).toHaveLength(2)
    expect(first.meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    })

    const last = await readHistory(alice, findingId, "?pageSize=2&page=3")
    expect(last.items).toHaveLength(1)
    expect(last.items[0]?.toStatus).toBe("OPEN")
  })

  it("não grava nada quando a mudança é recusada", async (): Promise<void> => {
    const findingId: string = await createFinding(alice, projectId, {
      title: "Achado com mudança recusada",
    })

    const response: ApiResponse = await changeStatus(alice, findingId, {
      status: "VERIFIED",
    })

    expect(response.status).toBe(409)
    const { items } = await readHistory(alice, findingId)
    expect(items).toHaveLength(1)
  })
})
