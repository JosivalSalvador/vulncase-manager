import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

type PaginationControlsProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Só aparece quando há mais de uma página.
export function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-end gap-3 pt-4 text-sm"
    >
      <span aria-live="polite" className="text-muted-foreground tabular-nums">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft data-icon="inline-start" />
        Anterior
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
        <ChevronRight data-icon="inline-end" />
      </Button>
    </nav>
  )
}
