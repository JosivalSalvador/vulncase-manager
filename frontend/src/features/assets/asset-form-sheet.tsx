import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormField } from "@/components/form-field"
import { FormSelect } from "@/components/form-select"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { ASSET_TYPES } from "./labels"
import { assetSchema, toAssetBody } from "./schema"
import type { Asset } from "./types"
import { useCreateAsset, useUpdateAsset } from "./use-asset-mutations"

type AssetFormSheetProps = {
  projectId: string
  // Sem ativo: cria um novo. Com ativo: edita.
  asset?: Asset
  onClose: () => void
}

export function AssetFormSheet({
  projectId,
  asset,
  onClose,
}: AssetFormSheetProps) {
  const create = useCreateAsset(projectId)
  const update = useUpdateAsset(projectId)
  const mutation = asset ? update : create

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: asset?.name ?? "",
      type: asset?.type ?? "WEB",
      identifier: asset?.identifier ?? "",
    },
  })

  const submit = handleSubmit((values) => {
    const body = toAssetBody(values)
    const options = { onSuccess: onClose }

    if (asset) update.mutate({ id: asset.id, body }, options)
    else create.mutate(body, options)
  })

  const submitLabel = asset ? "Salvar" : "Criar ativo"

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{asset ? "Editar ativo" : "Novo ativo"}</SheetTitle>
          <SheetDescription>
            Informe o nome e o tipo. O identificador (URL, IP, pacote ou
            repositório) é opcional.
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
            <FormSelect
              label="Tipo"
              error={errors.type?.message}
              {...register("type")}
            >
              {ASSET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </FormSelect>
            <FormField
              label="Identificador"
              autoComplete="off"
              error={errors.identifier?.message}
              {...register("identifier")}
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
