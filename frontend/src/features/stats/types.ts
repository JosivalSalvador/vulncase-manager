import type { FindingStatus, Severity } from "@/features/findings/labels"

// Resposta do GET /stats.
export type ProjectSummary = {
  id: string
  name: string
  total: number
  open: number
  openCritical: number
  overdue: number
}

export type OverallStats = {
  totals: {
    total: number
    open: number
    openCritical: number
    overdue: number
    stale: number
    staleDays: number
    bySeverity: Record<Severity, number>
    byStatus: Record<FindingStatus, number>
  }
  projects: ProjectSummary[]
}

// Resposta do GET /projects/:projectId/stats.
export type ProjectStats = {
  total: number
  open: number
  overdue: number
  stale: number
  staleDays: number
  bySeverity: Record<Severity, number>
  openBySeverity: Record<Severity, number>
  byStatus: Record<FindingStatus, number>
  // Já vem ordenada, da categoria com mais achados para a com menos.
  byOwasp: { category: string; count: number }[]
}
