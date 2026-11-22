import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/AppError.js"
import { daysAgo, startOfToday } from "../../utils/dates.js"
import { env } from "../../utils/getEnv.js"
import { OPEN_STATUSES } from "../findings/findings.transitions.js"
import { getProjectService } from "../projects/projects.service.js"
import {
  REPORT_CONTENT_TYPE,
  reportFilename,
  toCsv,
  toMarkdown,
} from "./reports.format.js"
import type { ReportFile, ReportFinding, ReportQuery } from "./reports.types.js"

// O relatório é montado em memória. O teto evita que um projeto enorme
// derrube a API; quem passar dele precisa filtrar ou dividir o projeto.
export const REPORT_MAX_FINDINGS = 5000

export async function buildReportService(
  projectId: string,
  query: ReportQuery,
): Promise<ReportFile> {
  const { format, staleDays } = query
  const project = await getProjectService(projectId)

  // Uma consulta só: o resumo e a lista saem do mesmo conjunto de achados,
  // então os números do relatório sempre batem com o que está listado.
  const rows = await prisma.finding.findMany({
    where: { projectId },
    include: {
      asset: { select: { name: true, type: true, identifier: true } },
      assignee: { select: { fullname: true } },
      reporter: { select: { fullname: true } },
    },
    orderBy: { createdAt: "asc" },
    take: REPORT_MAX_FINDINGS + 1,
  })

  if (rows.length > REPORT_MAX_FINDINGS) {
    throw new AppError(
      422,
      `O projeto tem mais de ${REPORT_MAX_FINDINGS} achados, mais do que cabe em um relatório`,
    )
  }

  // Mesmos critérios do dashboard: vencido e parado só valem para achados
  // abertos, e o "hoje" vem do fuso configurado (APP_TIMEZONE).
  const today = startOfToday().getTime()
  const staleBefore = daysAgo(staleDays).getTime()

  const findings: ReportFinding[] = rows.map((row) => {
    const open = OPEN_STATUSES.includes(row.status)
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      remediation: row.remediation,
      owaspCategory: row.owaspCategory,
      cwe: row.cwe,
      cve: row.cve,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      assetName: row.asset?.name ?? null,
      assetType: row.asset?.type ?? null,
      assetIdentifier: row.asset?.identifier ?? null,
      assigneeName: row.assignee?.fullname ?? null,
      reporterName: row.reporter.fullname,
      open,
      overdue: open && row.dueDate !== null && row.dueDate.getTime() < today,
      stale: open && row.createdAt.getTime() < staleBefore,
    }
  })

  const generatedOn = startOfToday().toISOString().slice(0, 10)

  return {
    filename: reportFilename(project.name, generatedOn, format),
    contentType: REPORT_CONTENT_TYPE[format],
    body:
      format === "csv"
        ? toCsv(findings)
        : toMarkdown({
            project: { name: project.name, description: project.description },
            generatedOn,
            timeZone: env.APP_TIMEZONE,
            staleDays,
            findings,
          }),
  }
}
