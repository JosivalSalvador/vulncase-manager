import type { FindingStatus } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import { startOfToday } from "../utils/dates.js"
import { bodyOf, type ApiResponse, type TestClient } from "./helpers.js"

export type SeverityName = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"

export interface NewFinding {
  title: string
  severity: SeverityName
  description?: string
  remediation?: string
  owaspCategory?: string
  cwe?: string
  cve?: string
  assetId?: string
  assigneeId?: string
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

// Data pura (AAAA-MM-DD) relativa a "hoje" no fuso da aplicação, a mesma base
// que o servidor usa para decidir se um prazo venceu.
export function dueDateIn(days: number): string {
  return new Date(startOfToday().getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

// Cria o achado pela API (o dono e o histórico nascem como na aplicação), leva
// até o status pedido e, se for o caso, volta a data de criação no tempo
// direto no banco (a API não deixa escolher o createdAt). Devolve o id.
export async function addFinding(
  client: TestClient,
  projectId: string,
  input: NewFinding,
): Promise<string> {
  const created: ApiResponse = await client.request(
    "POST",
    `/projects/${projectId}/findings`,
    {
      body: {
        title: input.title,
        description:
          input.description ?? "Achado criado para o cenário do teste.",
        severity: input.severity,
        ...(input.remediation ? { remediation: input.remediation } : {}),
        ...(input.owaspCategory ? { owaspCategory: input.owaspCategory } : {}),
        ...(input.cwe ? { cwe: input.cwe } : {}),
        ...(input.cve ? { cve: input.cve } : {}),
        ...(input.assetId ? { assetId: input.assetId } : {}),
        ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
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
      `/projects/${projectId}/findings/${findingId}/status`,
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

  return findingId
}
