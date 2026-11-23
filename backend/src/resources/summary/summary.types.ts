import type { z } from "zod"

import type { ReportFinding, ReportSummary } from "../reports/reports.types.js"
import type { summaryQuerySchema } from "./summary.schema.js"

export type SummaryQuery = z.infer<typeof summaryQuerySchema>

export interface SummaryTextInput {
  projectName: string
  staleDays: number
  findings: ReportFinding[]
}

export interface ProjectSummary {
  // Dia do calendário no fuso configurado (AAAA-MM-DD).
  generatedOn: string
  staleDays: number
  // Texto pronto, em parágrafos separados por uma linha em branco.
  text: string
  // Os mesmos números do relatório, para exibir em cartões ou gráficos.
  numbers: ReportSummary
}
