import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import type { FindingStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { createFinding, createProject, errorOf } from "../../test/fixtures.js"
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

const ALL_STATUSES: FindingStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "ACCEPTED_RISK",
  "FALSE_POSITIVE",
]

// Escrita à mão de propósito, em vez de importada de findings.transitions.ts:
// se alguém mudar a regra no código, estes testes precisam falhar.
const EXPECTED: Record<FindingStatus, FindingStatus[]> = {
  OPEN: ["IN_PROGRESS", "ACCEPTED_RISK", "FALSE_POSITIVE"],
  IN_PROGRESS: ["OPEN", "FIXED", "ACCEPTED_RISK", "FALSE_POSITIVE"],
  FIXED: ["VERIFIED", "IN_PROGRESS", "OPEN"],
  VERIFIED: ["OPEN"],
  ACCEPTED_RISK: ["OPEN"],
  FALSE_POSITIVE: ["OPEN"],
}

type Pair = [FindingStatus, FindingStatus]

const ALL_PAIRS: Pair[] = ALL_STATUSES.flatMap((from: FindingStatus): Pair[] =>
  ALL_STATUSES.map((to: FindingStatus): Pair => [from, to]),
)
const ALLOWED_PAIRS: Pair[] = ALL_PAIRS.filter(([from, to]: Pair): boolean =>
  EXPECTED[from].includes(to),
)
const BLOCKED_PAIRS: Pair[] = ALL_PAIRS.filter(
  ([from, to]: Pair): boolean => !EXPECTED[from].includes(to),
)

let server: TestServer
let alice: TestClient
let projectId: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({ email: uniqueEmail("alice") })
  alice = await signIn(server.baseUrl, aliceUser.email)

  projectId = await createProject(alice, "Projeto das transições")
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

describe("matriz de transições (os 36 pares de status)", (): void => {
  let findingId: string

  beforeAll(async (): Promise<void> => {
    findingId = await createFinding(alice, projectId, {
      title: "Achado da matriz de transições",
    })
  })

  // O status de partida é gravado direto no banco: o que se testa aqui é
  // só a regra da transição, não o caminho até chegar nela.
  it.each(ALLOWED_PAIRS)(
    "%s → %s é permitido e grava no histórico",
    async (from: FindingStatus, to: FindingStatus): Promise<void> => {
      await prisma.finding.update({
        where: { id: findingId },
        data: { status: from },
      })
      const before: number = await historyCount(findingId)

      const response: ApiResponse = await changeStatus(alice, findingId, {
        status: to,
      })

      expect(response.status).toBe(200)
      expect(bodyOf(response)["status"]).toBe(to)
      expect(await statusInDb(findingId)).toBe(to)
      expect(await historyCount(findingId)).toBe(before + 1)
    },
  )

  it.each(BLOCKED_PAIRS)(
    "%s → %s é recusado (409), sem mudar nada",
    async (from: FindingStatus, to: FindingStatus): Promise<void> => {
      await prisma.finding.update({
        where: { id: findingId },
        data: { status: from },
      })
      const before: number = await historyCount(findingId)

      const response: ApiResponse = await changeStatus(alice, findingId, {
        status: to,
      })

      expect(response.status).toBe(409)
      expect(await statusInDb(findingId)).toBe(from)
      expect(await historyCount(findingId)).toBe(before)
    },
  )

  it("explica o erro: mesmo status e transição fora da regra", async (): Promise<void> => {
    await prisma.finding.update({
      where: { id: findingId },
      data: { status: "OPEN" },
    })

    const same: ApiResponse = await changeStatus(alice, findingId, {
      status: "OPEN",
    })
    expect(errorOf(same)).toBe("O achado já está com o status OPEN")

    const illegal: ApiResponse = await changeStatus(alice, findingId, {
      status: "FIXED",
    })
    expect(errorOf(illegal)).toBe(
      "Não é possível mudar de OPEN para FIXED. " +
        "Permitidos: IN_PROGRESS, ACCEPTED_RISK, FALSE_POSITIVE",
    )
  })
})
