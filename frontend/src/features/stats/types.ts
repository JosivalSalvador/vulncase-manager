// Resposta do GET /stats. A contagem por severidade e por status entra na
// próxima parte, junto com a tela que a mostra.
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
  }
  projects: ProjectSummary[]
}
