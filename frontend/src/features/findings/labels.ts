// Severidade e status, na ordem em que aparecem na tela. As classes ficam
// escritas por inteiro porque o Tailwind não enxerga nomes montados.
export const SEVERITIES = [
  { value: "CRITICAL", label: "Crítica", color: "bg-severity-critical" },
  { value: "HIGH", label: "Alta", color: "bg-severity-high" },
  { value: "MEDIUM", label: "Média", color: "bg-severity-medium" },
  { value: "LOW", label: "Baixa", color: "bg-severity-low" },
  { value: "INFO", label: "Informativa", color: "bg-severity-info" },
] as const

export const STATUSES = [
  { value: "OPEN", label: "Aberto", color: "bg-status-open" },
  {
    value: "IN_PROGRESS",
    label: "Em correção",
    color: "bg-status-in-progress",
  },
  { value: "FIXED", label: "Corrigido", color: "bg-status-fixed" },
  { value: "VERIFIED", label: "Verificado", color: "bg-status-verified" },
  {
    value: "ACCEPTED_RISK",
    label: "Risco aceito",
    color: "bg-status-accepted-risk",
  },
  {
    value: "FALSE_POSITIVE",
    label: "Falso positivo",
    color: "bg-status-false-positive",
  },
] as const

export type Severity = (typeof SEVERITIES)[number]["value"]
export type FindingStatus = (typeof STATUSES)[number]["value"]
