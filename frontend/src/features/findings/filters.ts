import {
  SEVERITIES,
  STATUSES,
  type FindingStatus,
  type Severity,
} from "./labels"

// "Parados há mais de N dias": os valores que a tela oferece. O back aceita de 1
// a 365, e o painel do projeto usa 30.
export const STALE_OPTIONS = [
  { value: 7, label: "Mais de 7 dias" },
  { value: 30, label: "Mais de 30 dias" },
  { value: 60, label: "Mais de 60 dias" },
  { value: 90, label: "Mais de 90 dias" },
] as const

// Valor inválido na URL (?severity=abc) vira "sem filtro".
export function parseSeverity(value: string | null): Severity | undefined {
  return SEVERITIES.find((item) => item.value === value)?.value
}

export function parseStatus(value: string | null): FindingStatus | undefined {
  return STATUSES.find((item) => item.value === value)?.value
}

export function parseStale(value: string | null): number | undefined {
  return STALE_OPTIONS.find((item) => String(item.value) === value)?.value
}
