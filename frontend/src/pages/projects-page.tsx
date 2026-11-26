import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"

import { FormField } from "@/components/form-field"
import { PaginationControls } from "@/components/pagination-controls"
import { Button } from "@/components/ui/button"
import { ProjectListTable } from "@/features/projects/project-list-table"
import { useProjects } from "@/features/projects/use-projects"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import { Pencil, Plus, Trash2 } from "lucide-react"

import { useCurrentUser } from "@/features/auth/use-current-user"
import { DeleteProjectDialog } from "@/features/projects/delete-project-dialog"
import {
  canDeleteProject,
  canWriteProjects,
} from "@/features/projects/permissions"
import { ProjectFormSheet } from "@/features/projects/project-form-sheet"
import type { Project } from "@/features/projects/types"

const PAGE_SIZE = 10
const SEARCH_DELAY_MS = 300

// Página inválida na URL (?page=abc, 0, -1) vira a primeira.
function parsePage(value: string | null): number {
  const page = Number(value)

  return Number.isInteger(page) && page >= 1 ? page : 1
}

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get("page"))
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

  const { data, isPending, error, refetch, isPlaceholderData } = useProjects({
    page,
    pageSize: PAGE_SIZE,
    search,
  })

  const isEmpty = data !== undefined && data.data.length === 0
  const outOfRange = isEmpty && data.meta.total > 0
  const emptyMessage = search
    ? `Nenhum projeto encontrado para “${search}”.`
    : "Nenhum projeto ainda."

  const { data: user } = useCurrentUser()
  const canWrite = user ? canWriteProjects(user) : false

  // "new" abre o formulário de criação; um projeto abre o de edição.
  const [editing, setEditing] = useState<Project | "new" | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  // Leitor só consulta: sem coluna de ações.
  const renderActions =
    user && canWrite
      ? (project: Project) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar ${project.name}`}
              onClick={() => setEditing(project)}
            >
              <Pencil />
            </Button>
            {canDeleteProject(user, project) && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Excluir ${project.name}`}
                onClick={() => setDeleting(project)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )
      : undefined
  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Escolha um projeto para ver os achados.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            Novo projeto
          </Button>
        )}
      </header>

      <div className="max-w-sm">
        <FormField
          label="Buscar por nome"
          type="search"
          autoComplete="off"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
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
                {outOfRange ? "Nenhum projeto nesta página." : emptyMessage}
              </p>
              {outOfRange && (
                <Button variant="outline" onClick={() => goToPage(1)}>
                  Ir para a primeira página
                </Button>
              )}
            </div>
          ) : (
            <>
              <ProjectListTable
                projects={data.data}
                renderActions={renderActions}
              />
              <PaginationControls
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={goToPage}
              />
            </>
          )}
        </div>
      )}
      {editing && (
        <ProjectFormSheet
          project={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
