import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormField } from "@/components/form-field"
import { FormTextarea } from "@/components/form-textarea"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { projectSchema, toProjectBody } from "./schema"
import type { Project } from "./types"
import { useCreateProject, useUpdateProject } from "./use-project-mutations"

type ProjectFormSheetProps = {
  // Sem projeto: cria um novo. Com projeto: edita.
  project?: Project
  onClose: () => void
}

export function ProjectFormSheet({ project, onClose }: ProjectFormSheetProps) {
  const create = useCreateProject()
  const update = useUpdateProject()
  const mutation = project ? update : create

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
  })

  const submit = handleSubmit((values) => {
    const body = toProjectBody(values)
    const options = { onSuccess: onClose }

    if (project) update.mutate({ id: project.id, body }, options)
    else create.mutate(body, options)
  })

  const submitLabel = project ? "Salvar" : "Criar projeto"

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{project ? "Editar projeto" : "Novo projeto"}</SheetTitle>
          <SheetDescription>
            Dê um nome ao projeto. A descrição é opcional.
          </SheetDescription>
        </SheetHeader>

        <form
          noValidate
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4"
        >
          <div className="grid gap-4 px-4">
            <FormField
              label="Nome"
              autoComplete="off"
              error={errors.name?.message}
              {...register("name")}
            />
            <FormTextarea
              label="Descrição"
              rows={5}
              error={errors.description?.message}
              {...register("description")}
            />

            {mutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={mutation.isPending}
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
