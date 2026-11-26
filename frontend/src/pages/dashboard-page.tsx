import { Button } from "@/components/ui/button"
import { ProjectsTable } from "@/features/stats/projects-table"
import { StatCards } from "@/features/stats/stat-cards"
import { useOverallStats } from "@/features/stats/use-overall-stats"
import { SEVERITIES, STATUSES } from "@/features/findings/labels"
import { CountBars } from "@/features/stats/count-bars"

export function DashboardPage() {
  const { data, isPending, error, refetch } = useOverallStats()

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Situação dos projetos que você acompanha.
        </p>
      </header>

      {isPending && (
        <p role="status" className="text-muted-foreground">
          Carregando…
        </p>
      )}

      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && (
        <>
          <StatCards totals={data.totals} />
          <div className="grid gap-3 lg:grid-cols-2">
            <CountBars
              title="Por severidade"
              options={SEVERITIES}
              counts={data.totals.bySeverity}
            />
            <CountBars
              title="Por status"
              options={STATUSES}
              counts={data.totals.byStatus}
            />
          </div>
          <ProjectsTable projects={data.projects} />
        </>
      )}
    </div>
  )
}
