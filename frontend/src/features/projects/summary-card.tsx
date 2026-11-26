import { Button } from "@/components/ui/button"

import { useProjectSummary } from "./use-project-summary"

// "2026-11-26" -> "26/11/2026", sem passar por Date (evita deslocar o dia).
function formatDay(day: string): string {
  const [year, month, date] = day.split("-")

  return `${date}/${month}/${year}`
}

export function SummaryCard({ projectId }: { projectId: string }) {
  const { data, isPending, error, refetch } = useProjectSummary(projectId)

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <header className="space-y-0.5">
        <h2 className="font-medium">Resumo automático</h2>
        {data && (
          <p className="text-sm text-muted-foreground">
            Gerado em {formatDay(data.generatedOn)}, a partir dos achados do
            projeto.
          </p>
        )}
      </header>

      {isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando…
        </p>
      )}

      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-3 text-sm">
          {data.text.split(/\n\s*\n/).map((paragraph) => (
            // Uma quebra de linha simples (lista numerada) é mantida.
            <p key={paragraph} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
