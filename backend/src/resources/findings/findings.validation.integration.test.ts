import { randomUUID } from "node:crypto"

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
  projectId = await createProject(alice, "Projeto da validação de status")
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

async function statusInDb(findingId: string): Promise<FindingStatus> {
  const finding = await prisma.finding.findUniqueOrThrow({
    where: { id: findingId },
    select: { status: true },
  })
  return finding.status
}

function historyCount(findingId: string): Promise<number> {
  return prisma.statusHistory.count({ where: { findingId } })
}

describe("validação e erros da rota de status", (): void => {
  let findingId: string

  beforeAll(async (): Promise<void> => {
    findingId = await createFinding(alice, projectId, {
      title: "Achado da validação de status",
    })
  })

  it.each([
    ["fora da lista", "DONE"],
    ["em minúsculas", "in_progress"],
    ["vazio", ""],
    ["nulo", null],
    ["número", 1],
    ["ausente", undefined],
  ])(
    "status %s dá 400 e o achado não muda",
    async (_label: string, status: unknown): Promise<void> => {
      const response: ApiResponse = await changeStatus(alice, findingId, {
        status,
      })

      expect(response.status).toBe(400)
      expect(bodyOf(response)["details"]).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "status" })]),
      )
      expect(await statusInDb(findingId)).toBe("OPEN")
    },
  )

  it("ignora campos além do status (mass assignment)", async (): Promise<void> => {
    const response: ApiResponse = await changeStatus(alice, findingId, {
      status: "IN_PROGRESS",
      severity: "LOW",
      reporterId: brunoId,
    })

    expect(response.status).toBe(200)
    const finding = await prisma.finding.findUniqueOrThrow({
      where: { id: findingId },
      select: { status: true, severity: true, reporterId: true },
    })
    expect(finding).toEqual({
      status: "IN_PROGRESS",
      severity: "HIGH",
      reporterId: aliceId,
    })
  })

  it("achado que não existe dá 404, e id mal formado dá 400", async (): Promise<void> => {
    const missing: ApiResponse = await changeStatus(alice, randomUUID(), {
      status: "IN_PROGRESS",
    })
    expect(missing.status).toBe(404)

    const malformed: ApiResponse = await changeStatus(alice, "nao-e-um-id", {
      status: "IN_PROGRESS",
    })
    expect(malformed.status).toBe(400)
  })

  it("duas mudanças iguais ao mesmo tempo: só uma vale e o histórico não duplica", async (): Promise<void> => {
    const raceFinding: string = await createFinding(alice, projectId, {
      title: "Achado da corrida",
    })

    const responses: ApiResponse[] = await Promise.all([
      changeStatus(alice, raceFinding, { status: "IN_PROGRESS" }),
      changeStatus(bruno, raceFinding, { status: "IN_PROGRESS" }),
    ])

    expect(
      responses.map((response: ApiResponse): number => response.status).sort(),
    ).toEqual([200, 409])
    expect(await statusInDb(raceFinding)).toBe("IN_PROGRESS")
    // A criação (OPEN) e uma única mudança para IN_PROGRESS.
    expect(await historyCount(raceFinding)).toBe(2)
  })
})
