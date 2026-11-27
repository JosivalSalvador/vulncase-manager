import { useNavigate } from "react-router"

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

import type { Member } from "./types"
import { useLeaveProject, useRemoveMember } from "./use-member-mutations"

type RemoveMemberDialogProps = {
  projectId: string
  member: Member
  // O próprio usuário saindo do projeto (e não alguém tirando outra pessoa).
  leaving: boolean
  onClose: () => void
}

export function RemoveMemberDialog({
  projectId,
  member,
  leaving,
  onClose,
}: RemoveMemberDialogProps) {
  const navigate = useNavigate()
  const remove = useRemoveMember(projectId)
  const leave = useLeaveProject(projectId)
  const mutation = leaving ? leave : remove

  // Quem sai perde o acesso: não adianta ficar na página do projeto.
  const afterSuccess = leaving ? () => navigate("/projects") : onClose

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {leaving ? "Sair do projeto?" : "Remover membro?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {leaving
              ? "Você perde o acesso ao projeto, e os achados sob a sua responsabilidade ficam sem responsável. Para voltar, o dono ou um ADMIN precisa te adicionar de novo."
              : `“${member.fullname}” perde o acesso ao projeto, e os achados sob a responsabilidade dessa pessoa ficam sem responsável.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(member.userId, { onSuccess: afterSuccess })
            }
          >
            {mutation.isPending
              ? leaving
                ? "Saindo…"
                : "Removendo…"
              : leaving
                ? "Sair do projeto"
                : "Remover"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
