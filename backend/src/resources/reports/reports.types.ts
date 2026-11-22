import type { z } from "zod"

import type { severitySchema } from "../findings/findings.schema.js"
import type { FindingStatus } from "../findings/findings.types.js"
import type { reportQuerySchema } from "./reports.schema.js"

export type Severity = z.infer<typeof severitySchema>

export type ReportQuery = z.infer<typeof reportQuerySchema>

export type ReportFormat = ReportQuery["format"]

// Um achado já "achatado" para o relatório: sem relações aninhadas, e com
// vencido/parado calculados pelo service, no mesmo critério do dashboard.
export interface ReportFinding {
  id: string
  title: string
  description: string
  severity: Severity
  status: FindingStatus
  remediation: string | null
  owaspCategory: string | null
  cwe: string | null
  cve: string | null
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  assetName: string | null
  assetType: string | null
  assetIdentifier: string | null
  assigneeName: string | null
  reporterName: string
  open: boolean
  overdue: boolean
  stale: boolean
}

export interface ReportSummary {
  total: number
  open: number
  overdue: number
  stale: number
  bySeverity: Record<Severity, number>
  byStatus: Record<FindingStatus, number>
}

export interface MarkdownReportInput {
  project: { name: string; description: string | null }
  // Dia do calendário no fuso configurado (AAAA-MM-DD).
  generatedOn: string
  // Fuso (APP_TIMEZONE) usado para mostrar as datas de criação e atualização.
  timeZone: string
  staleDays: number
  findings: ReportFinding[]
}

export interface ReportFile {
  filename: string
  contentType: string
  body: string
}
