import { env } from "./getEnv.js"

// Data de hoje no fuso configurado (APP_TIMEZONE), representada como
// meia-noite UTC. O prazo (dueDate) é guardado como data pura ("2026-12-31"
// vira meia-noite UTC), então "hoje" precisa estar na mesma base: o dia do
// calendário no fuso do usuário, e não o dia em UTC. Em Manaus (UTC-4), a
// partir das 20h o UTC já é o dia seguinte, e o prazo de hoje apareceria
// vencido quatro horas antes da hora.
export function startOfToday(
  now: Date = new Date(),
  timeZone: string = env.APP_TIMEZONE,
): Date {
  // O locale "en-CA" formata a data como AAAA-MM-DD.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now)
  return new Date(`${day}T00:00:00.000Z`)
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}
