import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"

import { FormField } from "@/components/form-field"
import { PaginationControls } from "@/components/pagination-controls"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/features/auth/use-current-user"
import { DeleteFindingDialog } from "@/features/findings/delete-finding-dialog"
import {
  FindingFilters,
  type FilterKey,
} from "@/features/findings/finding-filters"
import { FindingFormSheet } from "@/features/findings/finding-form-sheet"
import { FindingListTable } from "@/features/findings/finding-list-table"
import {
  parseSeverity,
  parseStale,
  parseStatus,
} from "@/features/findings/filters"
import {
  canDeleteFinding,
  canWriteFindings,
} from "@/features/findings/permissions"
import type { Finding } from "@/features/findings/types"
import { useFindings } from "@/features/findings/use-findings"
import { useProject } from "@/features/projects/use-project"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

const PAGE_SIZE = 10
const SEARCH_DELAY_MS = 300

// Página inválida na URL (?page=abc, 0, -1) vira a primeira.
function parsePage(value: string | null): number {
  const page = Number(value)

  return Number.isInteger(page) && page >= 1 ? page : 1
}

export function ProjectFindingsPage() {
  const { projectId = "" } = useParams()
  const project = useProject(projectId)

  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get("page"))
  const severity = parseSeverity(searchParams.get("severity"))
  const status = parseStatus(searchParams.get("status"))
  const overdue = searchParams.get("overdue") === "true"
  const staleDays = parseStale(searchParams.get("stale"))
  const search = searchParams.get("search") ?? ""

  const [term, setTerm] = useState(search)
  const debouncedTerm = useDebouncedValue(term, SEARCH_DELAY_MS).trim()

  // A busca mudou: volta para a primeira página, sem empilhar histórico.
  useEffect(() => {
    if (debouncedTerm === search) return

    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current)

        params.delete("page")
        if (debouncedTerm) params.set("search", debouncedTerm)
        else params.delete("search")

        return params
      },
      { replace: true },
    )
  }, [debouncedTerm, search, setSearchParams])

  function goToPage(next: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)

      if (next > 1) params.set("page", String(next))
      else params.delete("page")

      return params
    })
  }

  // Mudou um filtro: volta para a primeira página.
  function changeFilter(key: FilterKey, value: string | undefined) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)

      params.delete("page")
      if (value) params.set(key, value)
      else params.delete(key)

      return params
    })
  }

  const { data, isPending, error, refetch, isPlaceholderData } = useFindings(
    projectId,
    {
      page,
      pageSize: PAGE_SIZE,
      severity,
      status,
      search,
      overdue: overdue || undefined,
      staleDays,
    },
  )

  const isFiltered =
    search !== "" ||
    severity !== undefined ||
    status !== undefined ||
    overdue ||
    staleDays !== undefined
  const isEmpty = data !== undefined && data.data.length === 0
  const outOfRange = isEmpty && data.meta.total > 0
  const emptyMessage = isFiltered
    ? "Nenhum achado encontrado com esse filtro."
    : "Nenhum achado ainda."

  const { data: user } = useCurrentUser()
  const canWrite = user ? canWriteFindings(user) : false
  // "new" abre o formulário de criação; um achado abre o de edição.
  const [editing, setEditing] = useState<Finding | "new" | null>(null)
  const [deleting, setDeleting] = useState<Finding | null>(null)

  // Leitor só consulta: sem coluna de ações.
  const renderActions = canWrite
    ? (finding: Finding) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${finding.title}`}
            onClick={() => setEditing(finding)}
          >
            <Pencil />
          </Button>
          {user &&
            project.data &&
            canDeleteFinding(user, project.data, finding) && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Excluir ${finding.title}`}
                onClick={() => setDeleting(finding)}
              >
                <Trash2 />
              </Button>
            )}
        </div>
      )
    : undefined

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
            to={`/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Voltar para o projeto
          </Link>
          <h1 className="text-2xl font-semibold">Achados</h1>
          {project.data && (
            <p className="text-sm text-muted-foreground">{project.data.name}</p>
          )}
        </div>
        {canWrite && (
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            Novo achado
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-sm">
          <FormField
            label="Buscar por título"
            type="search"
            autoComplete="off"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <FindingFilters
          severity={severity}
          status={status}
          overdue={overdue}
          staleDays={staleDays}
          onChange={changeFilter}
        />
      </div>

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
                {outOfRange ? "Nenhum achado nesta página." : emptyMessage}
              </p>
              {outOfRange && (
                <Button variant="outline" onClick={() => goToPage(1)}>
                  Ir para a primeira página
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {data.meta.total} {data.meta.total === 1 ? "achado" : "achados"}
              </p>
              <FindingListTable
                findings={data.data}
                renderActions={renderActions}
              />
              <PaginationControls
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </div>
      )}

      {editing && (
        <FindingFormSheet
          projectId={projectId}
          finding={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteFindingDialog
          projectId={projectId}
          finding={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
