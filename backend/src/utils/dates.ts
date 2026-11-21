// Início do dia de hoje em UTC. O prazo (dueDate) é guardado como data pura
// ("2026-12-31" vira meia-noite UTC), então comparamos na mesma base.
export function startOfTodayUtc(): Date {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}
