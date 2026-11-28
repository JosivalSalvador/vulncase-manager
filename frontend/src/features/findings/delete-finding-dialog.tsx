import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

import type { Finding } from "./types"
import { useDeleteFinding } from "./use-finding-mutations"

type DeleteFindingDialogProps = {
  projectId: string
  finding: Finding
  onClose: () => void
}

export function DeleteFindingDialog({
  projectId,
  finding,
  onClose,
}: DeleteFindingDialogProps) {
  const remove = useDeleteFinding(projectId)

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir achado?</AlertDialogTitle>
          <AlertDialogDescription>
            “{finding.title}” será excluído, junto com o histórico e as
            evidências dele. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {remove.error && (
          <p role="alert" className="text-sm text-destructive">
            {remove.error.message}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(finding.id, { onSuccess: onClose })}
          >
            {remove.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
