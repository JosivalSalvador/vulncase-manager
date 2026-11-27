import type { FindingStatus } from "./labels"

// Só achado aberto vence (mesma regra do back e dos números do painel).
const OPEN_STATUSES: readonly FindingStatus[] = ["OPEN", "IN_PROGRESS"]

// O prazo é só um dia: o back guarda a meia-noite UTC dele. Formatar no fuso
// local mostraria o dia anterior, então o formato fica em UTC.
const dueDateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" })

export function formatDueDate(dueDate: string): string {
  return dueDateFormat.format(new Date(dueDate))
}

// Hoje no calendário local, como AAAA-MM-DD (o locale "en-CA" já sai assim).
function today(now: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(now)
}

// Vencido: aberto e com o prazo num dia anterior a hoje. Compara só o dia
// (AAAA-MM-DD), que é como o back compara. O prazo de hoje ainda não venceu.
export function isOverdue(
  finding: { status: FindingStatus; dueDate: string | null },
  now: Date = new Date(),
): boolean {
  return (
    finding.dueDate !== null &&
    OPEN_STATUSES.includes(finding.status) &&
    finding.dueDate.slice(0, 10) < today(now)
  )
}
