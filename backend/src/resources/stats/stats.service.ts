import { prisma } from "../../lib/prisma.js"
import { daysAgo, startOfTodayUtc } from "../../utils/dates.js"
import type { PublicUser } from "../auth/auth.types.js"
import {
  findingStatusSchema,
  severitySchema,
} from "../findings/findings.schema.js"
import { OPEN_STATUSES } from "../findings/findings.transitions.js"
import type { StatsQuery } from "./stats.types.js"

const severities = severitySchema.options
const statuses = findingStatusSchema.options

interface CountRow<K extends string> {
  key: K
  count: number
}

// Garante que toda chave apareça na resposta, mesmo com zero achados.
function toCounts<K extends string>(
  keys: readonly K[],
  rows: CountRow<K>[],
): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
    K,
    number
  >
  for (const row of rows) {
    counts[row.key] += row.count
  }
  return counts
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export async function getProjectStatsService(
  projectId: string,
  query: StatsQuery,
) {
  const { staleDays } = query
  const where = { projectId }
  const open = { ...where, status: { in: OPEN_STATUSES } }

  // Tudo na mesma transação, para os números serem de um mesmo instante.
  const [bySeverity, byStatus, openBySeverity, byOwasp, overdue, stale] =
    await prisma.$transaction([
      prisma.finding.groupBy({
        by: ["severity"],
        where,
        _count: { _all: true },
      }),
      prisma.finding.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.finding.groupBy({
        by: ["severity"],
        where: open,
        _count: { _all: true },
      }),
      prisma.finding.groupBy({
        by: ["owaspCategory"],
        where: { ...where, owaspCategory: { not: null } },
        _count: { _all: true },
      }),
      prisma.finding.count({
        where: { ...open, dueDate: { lt: startOfTodayUtc() } },
      }),
      prisma.finding.count({
        where: { ...open, createdAt: { lt: daysAgo(staleDays) } },
      }),
    ])

  const severityCounts = (rows: typeof bySeverity) =>
    toCounts(
      severities,
      rows.map((row) => ({ key: row.severity, count: row._count._all })),
    )

  const owasp = byOwasp
    .flatMap((row) =>
      row.owaspCategory === null
        ? []
        : [{ category: row.owaspCategory, count: row._count._all }],
    )
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))

  return {
    total: sum(bySeverity.map((row) => row._count._all)),
    open: sum(openBySeverity.map((row) => row._count._all)),
    overdue,
    stale,
    staleDays,
    bySeverity: severityCounts(bySeverity),
    openBySeverity: severityCounts(openBySeverity),
    byStatus: toCounts(
      statuses,
      byStatus.map((row) => ({ key: row.status, count: row._count._all })),
    ),
    byOwasp: owasp,
  }
}

export async function getOverallStatsService(
  user: PublicUser,
  query: StatsQuery,
) {
  const { staleDays } = query

  // ADMIN vê todos os projetos; os demais só aqueles de que participam.
  const visibility =
    user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } }
  const scope = { project: visibility }
  const open = { ...scope, status: { in: OPEN_STATUSES } }

  const [
    projects,
    totalByProject,
    openByProject,
    openCriticalByProject,
    overdueByProject,
    bySeverity,
    byStatus,
    stale,
  ] = await prisma.$transaction([
    // A tabela do dashboard mostra até 100 projetos; a lista completa fica
    // em GET /projects. Os totais abaixo consideram TODOS os projetos.
    prisma.project.findMany({
      where: visibility,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.finding.groupBy({
      by: ["projectId"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.finding.groupBy({
      by: ["projectId"],
      where: open,
      _count: { _all: true },
    }),
    prisma.finding.groupBy({
      by: ["projectId"],
      where: { ...open, severity: "CRITICAL" },
      _count: { _all: true },
    }),
    prisma.finding.groupBy({
      by: ["projectId"],
      where: { ...open, dueDate: { lt: startOfTodayUtc() } },
      _count: { _all: true },
    }),
    prisma.finding.groupBy({
      by: ["severity"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.finding.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.finding.count({
      where: { ...open, createdAt: { lt: daysAgo(staleDays) } },
    }),
  ])

  const byProjectId = (rows: typeof totalByProject) =>
    new Map(rows.map((row) => [row.projectId, row._count._all]))

  const total = byProjectId(totalByProject)
  const openCount = byProjectId(openByProject)
  const openCritical = byProjectId(openCriticalByProject)
  const overdue = byProjectId(overdueByProject)

  return {
    totals: {
      total: sum([...total.values()]),
      open: sum([...openCount.values()]),
      openCritical: sum([...openCritical.values()]),
      overdue: sum([...overdue.values()]),
      stale,
      staleDays,
      bySeverity: toCounts(
        severities,
        bySeverity.map((row) => ({
          key: row.severity,
          count: row._count._all,
        })),
      ),
      byStatus: toCounts(
        statuses,
        byStatus.map((row) => ({ key: row.status, count: row._count._all })),
      ),
    },
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      total: total.get(project.id) ?? 0,
      open: openCount.get(project.id) ?? 0,
      openCritical: openCritical.get(project.id) ?? 0,
      overdue: overdue.get(project.id) ?? 0,
    })),
  }
}
