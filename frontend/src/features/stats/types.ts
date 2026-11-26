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
