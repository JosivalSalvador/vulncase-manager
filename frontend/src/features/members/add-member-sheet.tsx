import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { addMemberSchema } from "./schema"
import { useAddMember } from "./use-member-mutations"

type AddMemberSheetProps = {
  projectId: string
  onClose: () => void
}

export function AddMemberSheet({ projectId, onClose }: AddMemberSheetProps) {
  const add = useAddMember(projectId)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: "" },
  })

  const submit = handleSubmit((values) => {
    add.mutate(values, { onSuccess: onClose })
  })

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !add.isPending) onClose()
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Adicionar membro</SheetTitle>
          <SheetDescription>
            Informe o e-mail de quem já tem conta. A pessoa passa a ter acesso
            ao projeto.
          </SheetDescription>
        </SheetHeader>

        <form
          noValidate
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4"
        >
          <div className="grid gap-4 px-4">
            <FormField
              label="E-mail"
              type="email"
              autoComplete="off"
              error={errors.email?.message}
              {...register("email")}
            />

            {add.error && (
              <p role="alert" className="text-sm text-destructive">
                {add.error.message}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button type="submit" size="lg" disabled={add.isPending}>
              {add.isPending ? "Adicionando…" : "Adicionar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={add.isPending}
              onClick={onClose}
            >
              Cancelar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
