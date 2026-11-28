import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { useForm, useWatch } from "react-hook-form"

import { FormField } from "@/components/form-field"
import { FormSelect } from "@/components/form-select"
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
import { useAssets } from "@/features/assets/use-assets"
import { useCweCatalog } from "@/features/catalog/use-cwe-catalog"
import { useOwaspOptions } from "@/features/catalog/use-owasp-catalog"
import { useMembers } from "@/features/members/use-members"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import { DuplicatesWarning } from "./duplicates-warning"
import { SEVERITIES } from "./labels"
import {
  findingSchema,
  toDuplicatesParams,
  toFindingBody,
  toFindingFormValues,
  type FindingFormValues,
} from "./schema"
import type { Finding } from "./types"
import { useDuplicates } from "./use-duplicates"
import { useCreateFinding, useUpdateFinding } from "./use-finding-mutations"

// O máximo que o back aceita numa página.
const OPTIONS_LIMIT = 100
const DUPLICATES_DELAY_MS = 400
const OWASP_EDITIONS = ["2025", "2021"] as const

const EMPTY_VALUES: FindingFormValues = {
  title: "",
  description: "",
  severity: "MEDIUM",
  remediation: "",
  owaspCategory: "",
  cwe: "",
  cve: "",
  dueDate: "",
  assetId: "",
  assigneeId: "",
}

type FindingFormSheetProps = {
  projectId: string
  // Sem achado: cria um novo. Com achado: edita.
  finding?: Finding
  onClose: () => void
}

export function FindingFormSheet({
  projectId,
  finding,
  onClose,
}: FindingFormSheetProps) {
  const create = useCreateFinding(projectId)
  const update = useUpdateFinding(projectId)
  const mutation = finding ? update : create
  const assets = useAssets(projectId, { pageSize: OPTIONS_LIMIT })
  const members = useMembers(projectId, { pageSize: OPTIONS_LIMIT })
  const owasp = useOwaspOptions()
  const cwes = useCweCatalog()
  const cweListId = useId()

  // Na edição, os campos só entram depois das listas: um <select> sem a opção
  // atual mostraria "Sem ativo" mesmo com o achado ligado a um.
  const waiting =
    finding !== undefined && !(assets.data && members.data && owasp.data)
  const loadError = assets.error ?? members.error ?? owasp.error

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(findingSchema),
    defaultValues: finding ? toFindingFormValues(finding) : EMPTY_VALUES,
  })

  const [title, assetId, cwe, cve] = useWatch({
    control,
    name: ["title", "assetId", "cwe", "cve"],
  })
  // Espera a pessoa parar de digitar antes de perguntar ao back.
  const typedTitle = useDebouncedValue(title, DUPLICATES_DELAY_MS)
  const typedCwe = useDebouncedValue(cwe, DUPLICATES_DELAY_MS)
  const typedCve = useDebouncedValue(cve, DUPLICATES_DELAY_MS)
  // Só no cadastro: na edição, o próprio achado apareceria como parecido.
  const duplicates = useDuplicates(
    projectId,
    finding
      ? null
      : toDuplicatesParams({
          title: typedTitle,
          assetId,
          cwe: typedCwe,
          cve: typedCve,
        }),
  )

  const submit = handleSubmit((values) => {
    const body = toFindingBody(values)
    const options = { onSuccess: onClose }

    if (finding) update.mutate({ id: finding.id, body }, options)
    else create.mutate(body, options)
  })

  const submitLabel = finding ? "Salvar" : "Criar achado"

  return (
    // Clicar fora não fecha: o formulário é longo, e o texto se perderia.
    <Sheet
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{finding ? "Editar achado" : "Novo achado"}</SheetTitle>
          <SheetDescription>
            Título, descrição e severidade são obrigatórios.{" "}
            {finding
              ? "O status não muda por aqui."
              : "O achado começa como Aberto."}
          </SheetDescription>
        </SheetHeader>

        <form
          noValidate
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-1 *:shrink-0">
            {waiting ? (
              !loadError && <p role="status">Carregando…</p>
            ) : (
              <>
                <FormField
                  label="Título"
                  autoComplete="off"
                  error={errors.title?.message}
                  {...register("title")}
                />
                <DuplicatesWarning duplicates={duplicates.data ?? []} />
                <FormTextarea
                  label="Descrição"
                  rows={4}
                  error={errors.description?.message}
                  {...register("description")}
                />
                <FormSelect
                  label="Severidade"
                  error={errors.severity?.message}
                  {...register("severity")}
                >
                  {SEVERITIES.map((severity) => (
                    <option key={severity.value} value={severity.value}>
                      {severity.label}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect label="Ativo" {...register("assetId")}>
                  <option value="">Sem ativo</option>
                  {assets.data?.data.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect label="Responsável" {...register("assigneeId")}>
                  <option value="">Sem responsável</option>
                  {members.data?.data.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.fullname}
                    </option>
                  ))}
                </FormSelect>
                <FormField label="Prazo" type="date" {...register("dueDate")} />
                <FormSelect
                  label="Categoria OWASP"
                  {...register("owaspCategory")}
                >
                  <option value="">Sem categoria</option>
                  {OWASP_EDITIONS.map((edition) => (
                    <optgroup key={edition} label={`Top 10:${edition}`}>
                      {owasp.data
                        ?.filter((entry) => entry.edition === edition)
                        .map((entry) => (
                          <option key={entry.code} value={entry.code}>
                            {entry.code} - {entry.namePt}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </FormSelect>
                <FormField
                  label="CWE"
                  placeholder="CWE-89"
                  autoComplete="off"
                  list={cweListId}
                  error={errors.cwe?.message}
                  {...register("cwe")}
                />
                <datalist id={cweListId}>
                  {cwes.data?.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.name}
                    </option>
                  ))}
                </datalist>
                <FormField
                  label="CVE"
                  placeholder="CVE-2024-12345"
                  autoComplete="off"
                  error={errors.cve?.message}
                  {...register("cve")}
                />
                <FormTextarea
                  label="Correção proposta"
                  rows={3}
                  error={errors.remediation?.message}
                  {...register("remediation")}
                />
              </>
            )}

            {loadError && (
              <p role="alert" className="text-sm text-destructive">
                {loadError.message}
              </p>
            )}
            {mutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button
              type="submit"
              size="lg"
              disabled={waiting || mutation.isPending}
            >
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
