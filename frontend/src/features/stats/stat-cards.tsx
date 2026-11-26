import type { OverallStats } from "./types"

type StatCardsProps = {
  totals: Pick<
    OverallStats["totals"],
    "total" | "open" | "openCritical" | "overdue" | "stale" | "staleDays"
  >
}

export function StatCards({ totals }: StatCardsProps) {
  const cards = [
    { label: "Achados", value: totals.total },
    { label: "Abertos", value: totals.open },
    { label: "Críticos abertos", value: totals.openCritical },
    { label: "Vencidos", value: totals.overdue },
    { label: `Parados há ${totals.staleDays}+ dias`, value: totals.stale },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{card.label}</dt>
          <dd className="text-3xl font-semibold tabular-nums">{card.value}</dd>
        </div>
      ))}
    </dl>
  )
}
