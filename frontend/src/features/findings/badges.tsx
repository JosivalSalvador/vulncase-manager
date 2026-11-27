import {
  SEVERITIES,
  STATUSES,
  type FindingStatus,
  type Severity,
} from "./labels"

// Classes escritas por inteiro, porque o Tailwind não enxerga nomes montados.
// O selo usa o tom como texto e, com 12% de opacidade, como fundo. O texto do
// selo sempre diz o valor: a cor nunca é a única informação.
const SEVERITY_BADGE: Record<Severity, string> = {
  CRITICAL: "bg-severity-critical/12 text-severity-critical",
  HIGH: "bg-severity-high/12 text-severity-high",
  MEDIUM: "bg-severity-medium/12 text-severity-medium",
  LOW: "bg-severity-low/12 text-severity-low",
  INFO: "bg-severity-info/12 text-severity-info",
}

const STATUS_BADGE: Record<FindingStatus, string> = {
  OPEN: "bg-status-open/12 text-status-open",
  IN_PROGRESS: "bg-status-in-progress/12 text-status-in-progress",
  FIXED: "bg-status-fixed/12 text-status-fixed",
  VERIFIED: "bg-status-verified/12 text-status-verified",
  ACCEPTED_RISK: "bg-status-accepted-risk/12 text-status-accepted-risk",
  FALSE_POSITIVE: "bg-status-false-positive/12 text-status-false-positive",
}

const BASE =
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"

export function SeverityBadge({ severity }: { severity: Severity }) {
  const label = SEVERITIES.find((item) => item.value === severity)?.label

  return (
    <span className={`${BASE} ${SEVERITY_BADGE[severity]}`}>
      {label ?? severity}
    </span>
  )
}

export function StatusBadge({ status }: { status: FindingStatus }) {
  const label = STATUSES.find((item) => item.value === status)?.label

  return (
    <span className={`${BASE} ${STATUS_BADGE[status]}`}>{label ?? status}</span>
  )
}
