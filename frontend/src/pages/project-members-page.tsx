import { ChevronLeft } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router"

import { PaginationControls } from "@/components/pagination-controls"
import { Button } from "@/components/ui/button"
import { MemberListTable } from "@/features/members/member-list-table"
import { useMembers } from "@/features/members/use-members"
import { useProject } from "@/features/projects/use-project"

const PAGE_SIZE = 10

// Página inválida na URL (?page=abc, 0, -1) vira a primeira.
function parsePage(value: string | null): number {
  const page = Number(value)

  return Number.isInteger(page) && page >= 1 ? page : 1
}

export function ProjectMembersPage() {
  const { projectId = "" } = useParams()
  const project = useProject(projectId)

  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get("page"))

  function goToPage(next: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)

      if (next > 1) params.set("page", String(next))
      else params.delete("page")

      return params
    })
  }

  const { data, isPending, error, refetch, isPlaceholderData } = useMembers(
    projectId,
    { page, pageSize: PAGE_SIZE },
  )

  const isEmpty = data !== undefined && data.data.length === 0
  const outOfRange = isEmpty && data.meta.total > 0

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
      <header className="space-y-1">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Voltar para o projeto
        </Link>
        <h1 className="text-2xl font-semibold">Membros</h1>
        {project.data && (
          <p className="text-sm text-muted-foreground">{project.data.name}</p>
        )}
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
        <div
          aria-busy={isPlaceholderData}
          className={isPlaceholderData ? "opacity-60" : undefined}
        >
          {isEmpty ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {outOfRange
                  ? "Nenhum membro nesta página."
                  : "Nenhum membro ainda."}
              </p>
              {outOfRange && (
                <Button variant="outline" onClick={() => goToPage(1)}>
                  Ir para a primeira página
                </Button>
              )}
            </div>
          ) : (
            <>
              <MemberListTable members={data.data} />
              <PaginationControls
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={goToPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
