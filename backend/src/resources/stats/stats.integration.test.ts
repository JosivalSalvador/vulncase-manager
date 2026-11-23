import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import type { FindingStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { addMember, createProject } from "../../test/fixtures.js"
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
import { startOfToday } from "../../utils/dates.js"

type SeverityName = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"

interface NewFinding {
  title: string
  severity: SeverityName
  owaspCategory?: string
  // Prazo em dias a partir de hoje (negativo: no passado). Omitido: sem prazo.
  dueInDays?: number
  // Há quantos dias o achado foi criado. Omitido: criado agora.
  createdDaysAgo?: number
  // Status final. Omitido: continua OPEN.
  status?: FindingStatus
}

const DAY_MS = 24 * 60 * 60 * 1000

// Caminho do OPEN até cada status, respeitando as transições permitidas.
const PATH_FROM_OPEN: Record<FindingStatus, FindingStatus[]> = {
  OPEN: [],
  IN_PROGRESS: ["IN_PROGRESS"],
  FIXED: ["IN_PROGRESS", "FIXED"],
  VERIFIED: ["IN_PROGRESS", "FIXED", "VERIFIED"],
  ACCEPTED_RISK: ["ACCEPTED_RISK"],
  FALSE_POSITIVE: ["FALSE_POSITIVE"],
}

const PROJECT_NAME = "Dashboard - com achados"
const EMPTY_PROJECT_NAME = "Dashboard - sem achados"
const CAROL_PROJECT_NAME = "Dashboard - da Carol"

// Os seis achados do projeto da Alice. Contas esperadas (staleDays = 30):
//   abertos (OPEN e IN_PROGRESS): o 1, o 2, o 3 e o 5
//   vencidos (abertos com prazo antes de hoje): o 1 e o 2
//   parados (abertos há mais de 30 dias): só o 3
const PROJECT_FINDINGS: NewFinding[] = [
  {
    title: "Acesso a dados de outro usuário (IDOR)",
    severity: "CRITICAL",
    owaspCategory: "A01:2021",
    dueInDays: -1,
  },
  {
    title: "SQL Injection no login",
    severity: "CRITICAL",
    owaspCategory: "A03:2021",
    dueInDays: -30,
    status: "IN_PROGRESS",
  },
  {
    // O prazo de hoje ainda não venceu.
    title: "Rota administrativa sem autorização",
    severity: "HIGH",
    owaspCategory: "A01:2021",
    dueInDays: 0,
    createdDaysAgo: 60,
  },
  {
    // Já corrigido: não conta como aberto, vencido nem parado.
    title: "XSS refletido na busca",
    severity: "HIGH",
    owaspCategory: "A03:2021",
    dueInDays: -30,
    createdDaysAgo: 90,
    status: "FIXED",
  },
  {
    title: "Injeção de comando na exportação",
    severity: "MEDIUM",
    owaspCategory: "A03:2021",
    createdDaysAgo: 20,
  },
  {
    // Sem categoria OWASP e com risco aceito: também não conta como aberto.
    title: "Banner do servidor expõe a versão",
    severity: "LOW",
    dueInDays: -30,
    createdDaysAgo: 100,
    status: "ACCEPTED_RISK",
  },
]

const PROJECT_BY_SEVERITY = {
  CRITICAL: 2,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 1,
  INFO: 0,
}

const PROJECT_BY_STATUS = {
  OPEN: 3,
  IN_PROGRESS: 1,
  FIXED: 1,
  VERIFIED: 0,
  ACCEPTED_RISK: 1,
  FALSE_POSITIVE: 0,
}

const NO_SEVERITIES = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
  INFO: 0,
}

const NO_STATUSES = {
  OPEN: 0,
  IN_PROGRESS: 0,
  FIXED: 0,
  VERIFIED: 0,
  ACCEPTED_RISK: 0,
  FALSE_POSITIVE: 0,
}

let server: TestServer
let alice: TestClient
let carol: TestClient
let admin: TestClient
let projectId: string
let emptyProjectId: string
let carolProjectId: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({ email: uniqueEmail("alice") })
  const carolUser = await createUser({ email: uniqueEmail("carol") })
  const adminUser = await createUser({
    email: uniqueEmail("admin"),
    role: "ADMIN",
  })
  alice = await signIn(server.baseUrl, aliceUser.email)
  carol = await signIn(server.baseUrl, carolUser.email)
  admin = await signIn(server.baseUrl, adminUser.email)

  // A Alice tem um projeto com achados e um vazio. A Carol tem o dela e
  // também participa do projeto da Alice.
  projectId = await createProject(alice, PROJECT_NAME)
  emptyProjectId = await createProject(alice, EMPTY_PROJECT_NAME)
  carolProjectId = await createProject(carol, CAROL_PROJECT_NAME)
  await addMember(alice, projectId, carolUser.email)

  for (const finding of PROJECT_FINDINGS) {
    await addFinding(alice, projectId, finding)
  }
  await addFinding(carol, carolProjectId, {
    title: "Senha padrão no painel de administração",
    severity: "HIGH",
    dueInDays: -5,
  })
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

// Data pura (AAAA-MM-DD) relativa a "hoje" no fuso da aplicação, a mesma base
// que o servidor usa para decidir se um prazo venceu.
function dueDateIn(days: number): string {
  return new Date(startOfToday().getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

// Cria o achado pela API e, se pedido, volta a data de criação no tempo
// direto no banco (a API não deixa escolher o createdAt).
async function addFinding(
  client: TestClient,
  project: string,
  input: NewFinding,
): Promise<void> {
  const created: ApiResponse = await client.request(
    "POST",
    `/projects/${project}/findings`,
    {
      body: {
        title: input.title,
        description: "Achado criado para conferir os números do dashboard.",
        severity: input.severity,
        ...(input.owaspCategory ? { owaspCategory: input.owaspCategory } : {}),
        ...(input.dueInDays !== undefined
          ? { dueDate: dueDateIn(input.dueInDays) }
          : {}),
      },
      csrf: true,
    },
  )
  const findingId: unknown =
    created.status === 201 ? bodyOf(created)["id"] : null
  if (typeof findingId !== "string") {
    throw new Error(
      `Não consegui criar "${input.title}" no teste: ${created.status} ` +
        JSON.stringify(created.body),
    )
  }

  for (const status of PATH_FROM_OPEN[input.status ?? "OPEN"]) {
    const changed: ApiResponse = await client.request(
      "PATCH",
      `/projects/${project}/findings/${findingId}/status`,
      { body: { status }, csrf: true },
    )
    if (changed.status !== 200) {
      throw new Error(
        `Não consegui mudar "${input.title}" para ${status} no teste: ` +
          `${changed.status} ${JSON.stringify(changed.body)}`,
      )
    }
  }

  if (input.createdDaysAgo !== undefined) {
    const createdAt = new Date(Date.now() - input.createdDaysAgo * DAY_MS)
    await prisma.finding.update({
      where: { id: findingId },
      data: { createdAt },
    })
  }
}

async function getBody(
  client: TestClient,
  path: string,
): Promise<Record<string, unknown>> {
  const response: ApiResponse = await client.request("GET", path)
  expect(response.status).toBe(200)
  return bodyOf(response)
}

function statsPath(project: string, query = ""): string {
  return `/projects/${project}/stats${query}`
}

function totalOf(list: Record<string, unknown>): unknown {
  return (list["meta"] as Record<string, unknown>)["total"]
}

describe("números de um projeto", (): void => {
  it("conta por severidade e por status, com zero onde não há achado", async (): Promise<void> => {
    const stats = await getBody(alice, statsPath(projectId))

    expect(stats["total"]).toBe(6)
    expect(stats["bySeverity"]).toEqual(PROJECT_BY_SEVERITY)
    expect(stats["byStatus"]).toEqual(PROJECT_BY_STATUS)
  })

  it("aberto é só OPEN e IN_PROGRESS, e vale também por severidade", async (): Promise<void> => {
    const stats = await getBody(alice, statsPath(projectId))

    expect(stats["open"]).toBe(4)
    expect(stats["openBySeverity"]).toEqual({
      CRITICAL: 2,
      HIGH: 1,
      MEDIUM: 1,
      LOW: 0,
      INFO: 0,
    })
  })

  it("vencido é prazo antes de hoje: o de hoje não vence e achado fechado nunca vence", async (): Promise<void> => {
    const stats = await getBody(alice, statsPath(projectId))

    expect(stats["overdue"]).toBe(2)
  })

  it("parado depende do staleDays e ignora os achados fechados", async (): Promise<void> => {
    const cases: Array<[string, number, number]> = [
      ["", 1, 30],
      ["?staleDays=10", 2, 10],
      ["?staleDays=90", 0, 90],
    ]

    for (const [query, stale, staleDays] of cases) {
      const stats = await getBody(alice, statsPath(projectId, query))
      expect(stats["stale"], query).toBe(stale)
      expect(stats["staleDays"], query).toBe(staleDays)
    }
  })

  it("agrupa por categoria OWASP, da mais frequente à menos, sem os achados sem categoria", async (): Promise<void> => {
    const stats = await getBody(alice, statsPath(projectId))

    expect(stats["byOwasp"]).toEqual([
      { category: "A03:2021", count: 3 },
      { category: "A01:2021", count: 2 },
    ])
  })

  it("um projeto sem achados devolve tudo zerado", async (): Promise<void> => {
    const stats = await getBody(alice, statsPath(emptyProjectId))

    expect(stats).toEqual({
      total: 0,
      open: 0,
      overdue: 0,
      stale: 0,
      staleDays: 30,
      bySeverity: NO_SEVERITIES,
      openBySeverity: NO_SEVERITIES,
      byStatus: NO_STATUSES,
      byOwasp: [],
    })
  })

  it("cada projeto conta só os seus achados", async (): Promise<void> => {
    const stats = await getBody(carol, statsPath(carolProjectId))

    expect(stats).toEqual({
      total: 1,
      open: 1,
      overdue: 1,
      stale: 0,
      staleDays: 30,
      bySeverity: { ...NO_SEVERITIES, HIGH: 1 },
      openBySeverity: { ...NO_SEVERITIES, HIGH: 1 },
      byStatus: { ...NO_STATUSES, OPEN: 1 },
      byOwasp: [],
    })
  })

  it("recusa staleDays fora do limite de 1 a 365", async (): Promise<void> => {
    for (const value of ["0", "366", "abc", "1.5"]) {
      const response: ApiResponse = await alice.request(
        "GET",
        statsPath(projectId, `?staleDays=${value}`),
      )
      expect(response.status, `staleDays=${value}`).toBe(400)
    }

    for (const value of ["1", "365"]) {
      const response: ApiResponse = await alice.request(
        "GET",
        statsPath(projectId, `?staleDays=${value}`),
      )
      expect(response.status, `staleDays=${value}`).toBe(200)
    }
  })
})

describe("números iguais aos da lista de achados filtrada", (): void => {
  it("vencidos, parados e abertos batem nos dois lugares", async (): Promise<void> => {
    const stats = await getBody(alice, statsPath(projectId))
    const base = `/projects/${projectId}/findings`

    const overdue = await getBody(alice, `${base}?overdue=true`)
    expect(totalOf(overdue)).toBe(stats["overdue"])

    const stale = await getBody(alice, `${base}?staleDays=30`)
    expect(totalOf(stale)).toBe(stats["stale"])

    const open = await getBody(alice, `${base}?status=OPEN`)
    const inProgress = await getBody(alice, `${base}?status=IN_PROGRESS`)
    expect(Number(totalOf(open)) + Number(totalOf(inProgress))).toBe(
      stats["open"],
    )
  })
})

describe("visão geral (GET /stats)", (): void => {
  it("soma só os projetos de que a pessoa participa", async (): Promise<void> => {
    const body = await getBody(alice, "/stats")

    // O projeto da Carol não entra nem nos totais nem na tabela.
    expect(body).toEqual({
      totals: {
        total: 6,
        open: 4,
        openCritical: 2,
        overdue: 2,
        stale: 1,
        staleDays: 30,
        bySeverity: PROJECT_BY_SEVERITY,
        byStatus: PROJECT_BY_STATUS,
      },
      projects: [
        {
          id: projectId,
          name: PROJECT_NAME,
          total: 6,
          open: 4,
          openCritical: 2,
          overdue: 2,
        },
        {
          id: emptyProjectId,
          name: EMPTY_PROJECT_NAME,
          total: 0,
          open: 0,
          openCritical: 0,
          overdue: 0,
        },
      ],
    })
  })

  it("quem participa de dois projetos vê a soma dos dois", async (): Promise<void> => {
    const body = await getBody(carol, "/stats")

    expect(body).toEqual({
      totals: {
        total: 7,
        open: 5,
        openCritical: 2,
        overdue: 3,
        stale: 1,
        staleDays: 30,
        bySeverity: { ...PROJECT_BY_SEVERITY, HIGH: 3 },
        byStatus: { ...PROJECT_BY_STATUS, OPEN: 4 },
      },
      projects: [
        {
          id: projectId,
          name: PROJECT_NAME,
          total: 6,
          open: 4,
          openCritical: 2,
          overdue: 2,
        },
        {
          id: carolProjectId,
          name: CAROL_PROJECT_NAME,
          total: 1,
          open: 1,
          openCritical: 0,
          overdue: 1,
        },
      ],
    })
  })

  it("o ADMIN vê todos os projetos", async (): Promise<void> => {
    const body = await getBody(admin, "/stats")
    const rows = body["projects"] as Array<Record<string, unknown>>
    const rowOf = (id: string): Record<string, unknown> | undefined =>
      rows.find((row): boolean => row["id"] === id)

    expect(rowOf(projectId)).toMatchObject({ total: 6, open: 4, overdue: 2 })
    expect(rowOf(carolProjectId)).toMatchObject({ total: 1, open: 1 })
    expect(rowOf(emptyProjectId)).toMatchObject({ total: 0, open: 0 })

    const totals = body["totals"] as Record<string, number>
    expect(totals["total"]).toBeGreaterThanOrEqual(7)
  })

  it("aceita o staleDays e o repete na resposta", async (): Promise<void> => {
    const body = await getBody(alice, "/stats?staleDays=10")
    const totals = body["totals"] as Record<string, unknown>

    expect(totals["stale"]).toBe(2)
    expect(totals["staleDays"]).toBe(10)
  })

  it("recusa staleDays fora do limite de 1 a 365", async (): Promise<void> => {
    for (const value of ["0", "366", "abc"]) {
      const response: ApiResponse = await alice.request(
        "GET",
        `/stats?staleDays=${value}`,
      )
      expect(response.status, `staleDays=${value}`).toBe(400)
    }
  })
})
