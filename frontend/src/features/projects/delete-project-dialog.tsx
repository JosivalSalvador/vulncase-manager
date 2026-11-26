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

import type { Project } from "./types"
import { useDeleteProject } from "./use-project-mutations"

type DeleteProjectDialogProps = {
  project: Project
  onClose: () => void
}

export function DeleteProjectDialog({
  project,
  onClose,
}: DeleteProjectDialogProps) {
  const remove = useDeleteProject()

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
          <AlertDialogDescription>
            “{project.name}” será excluído junto com os ativos, os achados e as
            evidências. Não dá para desfazer.
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
            onClick={() => remove.mutate(project.id, { onSuccess: onClose })}
          >
            {remove.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
