import { ChevronLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"

import { FormField } from "@/components/form-field"
import { PaginationControls } from "@/components/pagination-controls"
import { Button } from "@/components/ui/button"
import { AssetListTable } from "@/features/assets/asset-list-table"
import { AssetTypeFilter } from "@/features/assets/asset-type-filter"
import { ASSET_TYPES, type AssetType } from "@/features/assets/labels"
import { useAssets } from "@/features/assets/use-assets"
import { useProject } from "@/features/projects/use-project"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

const PAGE_SIZE = 10
const SEARCH_DELAY_MS = 300

// Página inválida na URL (?page=abc, 0, -1) vira a primeira.
function parsePage(value: string | null): number {
  const page = Number(value)

  return Number.isInteger(page) && page >= 1 ? page : 1
}

// Tipo inválido na URL (?type=abc) vira "todos".
function parseType(value: string | null): AssetType | undefined {
  return ASSET_TYPES.find((item) => item.value === value)?.value
}

export function ProjectAssetsPage() {
  const { projectId = "" } = useParams()
  const project = useProject(projectId)

  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get("page"))
  const type = parseType(searchParams.get("type"))
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

  function changeType(next: AssetType | undefined) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)

      params.delete("page")
      if (next) params.set("type", next)
      else params.delete("type")

      return params
    })
  }

  const { data, isPending, error, refetch, isPlaceholderData } = useAssets(
    projectId,
    { page, pageSize: PAGE_SIZE, type, search },
  )

  const isEmpty = data !== undefined && data.data.length === 0
  const outOfRange = isEmpty && data.meta.total > 0
  const emptyMessage =
    search !== "" || type !== undefined
      ? "Nenhum ativo encontrado com esse filtro."
      : "Nenhum ativo ainda."

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
        <h1 className="text-2xl font-semibold">Ativos</h1>
        {project.data && (
          <p className="text-sm text-muted-foreground">{project.data.name}</p>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-sm">
          <FormField
            label="Buscar por nome"
            type="search"
            autoComplete="off"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <AssetTypeFilter value={type} onChange={changeType} />
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
                {outOfRange ? "Nenhum ativo nesta página." : emptyMessage}
              </p>
              {outOfRange && (
                <Button variant="outline" onClick={() => goToPage(1)}>
                  Ir para a primeira página
                </Button>
              )}
            </div>
          ) : (
            <>
              <AssetListTable assets={data.data} />
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
