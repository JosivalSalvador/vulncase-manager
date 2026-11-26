import { ChevronLeft } from "lucide-react"
import { Link, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { useOwaspCatalog } from "@/features/catalog/use-owasp-catalog"
import { SEVERITIES, STATUSES } from "@/features/findings/labels"
import { useProject } from "@/features/projects/use-project"
import { CountBars } from "@/features/stats/count-bars"
import { OwaspBars } from "@/features/stats/owasp-bars"
import { StatCards } from "@/features/stats/stat-cards"
import { useProjectStats } from "@/features/stats/use-project-stats"
import { ReportDownloads } from "@/features/projects/report-downloads"
import { SummaryCard } from "@/features/projects/summary-card"

export function ProjectPage() {
  const { projectId = "" } = useParams()
  const project = useProject(projectId)
  const stats = useProjectStats(projectId)
  // Só enfeita o gráfico: se falhar, ficam os códigos.
  const owaspNames = useOwaspCatalog().data

  // Sem o projeto (não existe ou sem acesso), o resto da página não faz sentido.
  if (project.error) {
    return (
      <div className="space-y-3 p-4 md:p-8">
        <p role="alert" className="text-destructive">
          {project.error.message}
        </p>
        <Link to="/projects" className="underline underline-offset-4">
          Voltar para os projetos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Voltar para projetos
          </Link>
          <h1 className="text-2xl font-semibold">
            {project.data?.name ?? "Projeto"}
          </h1>
          {project.data?.description && (
            <p className="text-sm text-muted-foreground">
              {project.data.description}
            </p>
          )}
        </div>
        <ReportDownloads projectId={projectId} />
      </header>
      <SummaryCard projectId={projectId} />
      {stats.isPending && (
        <p role="status" className="text-muted-foreground">
          Carregando…
        </p>
      )}

      {stats.error && (
        <div className="space-y-2">
          <p role="alert" className="text-destructive">
            {stats.error.message}
          </p>
          <Button variant="outline" onClick={() => void stats.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {stats.data && (
        <>
          <StatCards
            totals={{
              ...stats.data,
              openCritical: stats.data.openBySeverity.CRITICAL,
            }}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <CountBars
              title="Por severidade"
              options={SEVERITIES}
              counts={stats.data.bySeverity}
            />
            <CountBars
              title="Por status"
              options={STATUSES}
              counts={stats.data.byStatus}
            />
          </div>
          <OwaspBars entries={stats.data.byOwasp} names={owaspNames} />
        </>
      )}
    </div>
  )
}
