import { startOfToday } from "../../utils/dates.js"
import { getProjectService } from "../projects/projects.service.js"
import { summarize } from "../reports/reports.format.js"
import { loadReportFindings } from "../reports/reports.service.js"
import { toSummaryText } from "./summary.template.js"
import type { ProjectSummary, SummaryQuery } from "./summary.types.js"

export async function buildSummaryService(
  projectId: string,
  query: SummaryQuery,
): Promise<ProjectSummary> {
  const { staleDays } = query
  const project = await getProjectService(projectId)

  // Os mesmos achados e os mesmos critérios do relatório e do dashboard
  // (vencido e parado só valem para achado aberto), então os números batem.
  const findings = await loadReportFindings(projectId, staleDays)

  return {
    generatedOn: startOfToday().toISOString().slice(0, 10),
    staleDays,
    text: toSummaryText({ projectName: project.name, staleDays, findings }),
    numbers: summarize(findings),
  }
}
