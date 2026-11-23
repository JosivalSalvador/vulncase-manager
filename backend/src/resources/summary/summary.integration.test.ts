import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { createProject } from "../../test/fixtures.js"
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
import { addFinding, type NewFinding } from "../../test/scenario.js"
import { startOfToday } from "../../utils/dates.js"

const PROJECT_NAME = "Resumo - com achados"
const EMPTY_NAME = "Resumo - sem achados"
const CLOSED_NAME = "Resumo - tudo fechado"
const BREAK_NAME = "Resumo - título com quebra"

// Contas esperadas (staleDays = 30):
//   abertos (OPEN e IN_PROGRESS): o 1, o 2, o 3 e o 5
//   vencidos (abertos com prazo antes de hoje): o 1 e o 2
//   parados (abertos há mais de 30 dias): só o 3
// As idades do 1 e do 2 são diferentes de propósito: na lista de prioridades,
// com a mesma severidade e os dois vencidos, o mais antigo vem primeiro.
const FINDINGS: NewFinding[] = [
  {
    title: "Acesso a dados de outro usuário (IDOR)",
    severity: "CRITICAL",
    owaspCategory: "A01:2021",
    dueInDays: -1,
    createdDaysAgo: 5,
  },
  {
    title: "SQL Injection no login",
    severity: "CRITICAL",
    owaspCategory: "A03:2021",
    dueInDays: -30,
    createdDaysAgo: 4,
    status: "IN_PROGRESS",
  },
  {
    title: "Rota administrativa sem autorização",
    severity: "HIGH",
    owaspCategory: "A01:2021",
    createdDaysAgo: 60,
  },
  {
    // Já corrigido: não conta como aberto, mas conta nas categorias OWASP.
    title: "XSS refletido na busca",
    severity: "HIGH",
    owaspCategory: "A03:2021",
    createdDaysAgo: 90,
    status: "FIXED",
  },
  {
    title: "Banner do servidor expõe a versão",
    severity: "LOW",
    createdDaysAgo: 20,
  },
]

const NUMBERS = {
  total: 5,
  open: 4,
  overdue: 2,
  stale: 1,
  bySeverity: {
    CRITICAL: 2,
    HIGH: 2,
    MEDIUM: 0,
    LOW: 1,
    INFO: 0,
  },
  byStatus: {
    OPEN: 3,
    IN_PROGRESS: 1,
    FIXED: 1,
    VERIFIED: 0,
    ACCEPTED_RISK: 0,
    FALSE_POSITIVE: 0,
  },
}

const PRIORITIES = [
  "Para tratar primeiro:",
  "1. Crítica: Acesso a dados de outro usuário (IDOR) (vencido)",
  "2. Crítica: SQL Injection no login (vencido)",
  "3. Alta: Rota administrativa sem autorização (parado)",
].join("\n")

let server: TestServer
let alice: TestClient
let projectId: string
let emptyProjectId: string
let closedProjectId: string
let breakProjectId: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({ email: uniqueEmail("alice") })
  alice = await signIn(server.baseUrl, aliceUser.email)

  projectId = await createProject(alice, PROJECT_NAME)
  emptyProjectId = await createProject(alice, EMPTY_NAME)
  closedProjectId = await createProject(alice, CLOSED_NAME)
  breakProjectId = await createProject(alice, BREAK_NAME)

  for (const finding of FINDINGS) {
    await addFinding(alice, projectId, finding)
  }
  await addFinding(alice, closedProjectId, {
    title: "XSS refletido na busca",
    severity: "HIGH",
    status: "FIXED",
  })
  // Um título com quebra de linha, que tenta forjar um item da lista.
  await addFinding(alice, breakProjectId, {
    title: "Falha grave\n9. Crítica: item falso",
    severity: "HIGH",
  })
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

async function getJson(path: string): Promise<Record<string, unknown>> {
  const response: ApiResponse = await alice.request("GET", path)
  expect(response.status).toBe(200)
  return bodyOf(response)
}

function summaryOf(
  project: string,
  query = "",
): Promise<Record<string, unknown>> {
  return getJson(`/projects/${project}/summary${query}`)
}

function paragraphsOf(summary: Record<string, unknown>): string[] {
  return (summary["text"] as string).split("\n\n")
}

describe("GET /projects/:id/summary", (): void => {
  it("devolve o dia, o staleDays, o texto e os números", async (): Promise<void> => {
    const summary = await summaryOf(projectId)

    expect(Object.keys(summary).sort()).toEqual([
      "generatedOn",
      "numbers",
      "staleDays",
      "text",
    ])
    expect(summary["generatedOn"]).toBe(
      startOfToday().toISOString().slice(0, 10),
    )
    expect(summary["staleDays"]).toBe(30)
    expect(summary["numbers"]).toEqual(NUMBERS)
  })

  it("monta o texto em cinco parágrafos, com os nomes e os números do projeto", async (): Promise<void> => {
    const summary = await summaryOf(projectId)

    expect(paragraphsOf(summary)).toEqual([
      "O projeto Resumo - com achados tem 5 achados no total, e 4 continuam abertos.",
      "Entre os abertos: 2 críticos, 1 alto e 1 baixo.",
      "Pedem atenção: 2 vencidos e 1 parado há mais de 30 dias.",
      PRIORITIES,
      "Categorias OWASP mais frequentes: A01:2021 (2), A03:2021 (2).",
    ])
  })

  it("os números são os mesmos do dashboard", async (): Promise<void> => {
    const summary = await summaryOf(projectId)
    const stats = await getJson(`/projects/${projectId}/stats`)
    const numbers = summary["numbers"] as Record<string, unknown>

    for (const key of [
      "total",
      "open",
      "overdue",
      "stale",
      "bySeverity",
      "byStatus",
    ]) {
      expect(numbers[key], key).toEqual(stats[key])
    }
  })

  it("usa o staleDays pedido, no texto e nos números", async (): Promise<void> => {
    const summary = await summaryOf(projectId, "?staleDays=10")
    const numbers = summary["numbers"] as Record<string, unknown>

    expect(summary["staleDays"]).toBe(10)
    expect(numbers["stale"]).toBe(2)
    expect(paragraphsOf(summary)[2]).toBe(
      "Pedem atenção: 2 vencidos e 2 parados há mais de 10 dias.",
    )
  })

  it("projeto sem achados: uma frase só e os números zerados", async (): Promise<void> => {
    const summary = await summaryOf(emptyProjectId)

    expect(summary["text"]).toBe(
      "O projeto Resumo - sem achados ainda não tem achados registrados.",
    )
    expect(summary["numbers"]).toMatchObject({
      total: 0,
      open: 0,
      overdue: 0,
      stale: 0,
    })
  })

  it("projeto sem nenhum aberto: diz que não há o que tratar", async (): Promise<void> => {
    const summary = await summaryOf(closedProjectId)

    expect(paragraphsOf(summary)).toEqual([
      "O projeto Resumo - tudo fechado tem 1 achado no total, e nenhum continua aberto.",
      "Não há achados abertos: todos já foram corrigidos, verificados, aceitos como risco ou marcados como falso positivo.",
    ])
  })

  it("um título com quebra de linha continua sendo um item só da lista", async (): Promise<void> => {
    const summary = await summaryOf(breakProjectId)
    const priorities = paragraphsOf(summary).find((paragraph): boolean =>
      paragraph.startsWith("Para tratar primeiro:"),
    )

    expect(priorities?.split("\n")).toEqual([
      "Para tratar primeiro:",
      "1. Alta: Falha grave 9. Crítica: item falso",
    ])
  })

  it("recusa staleDays fora do limite de 1 a 365", async (): Promise<void> => {
    for (const value of ["0", "366", "abc"]) {
      const response: ApiResponse = await alice.request(
        "GET",
        `/projects/${projectId}/summary?staleDays=${value}`,
      )
      expect(response.status, `staleDays=${value}`).toBe(400)
    }
  })
})
