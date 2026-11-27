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

import type { Asset } from "./types"
import { useDeleteAsset } from "./use-asset-mutations"

type DeleteAssetDialogProps = {
  projectId: string
  asset: Asset
  onClose: () => void
}

export function DeleteAssetDialog({
  projectId,
  asset,
  onClose,
}: DeleteAssetDialogProps) {
  const remove = useDeleteAsset(projectId)

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir ativo?</AlertDialogTitle>
          <AlertDialogDescription>
            “{asset.name}” será excluído. Os achados ligados a ele não são
            apagados: ficam sem ativo. Não dá para desfazer.
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
            onClick={() => remove.mutate(asset.id, { onSuccess: onClose })}
          >
            {remove.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
