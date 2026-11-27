import { z } from "zod"

import type { DuplicatesParams } from "./api"
import { SEVERITIES } from "./labels"
import type { Finding, FindingBody } from "./types"

const TITLE_MIN = 3
const TITLE_MAX = 200
const TEXT_MAX = 10_000
const CWE_PATTERN = /^CWE-\d{1,5}$/
const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/

// Código opcional com formato fixo: vazio passa, e minúsculas viram maiúsculas.
function optionalCode(pattern: RegExp, message: string) {
  return z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || pattern.test(value), message)
}

// Espelha o createFindingSchema do back, só para avisar antes de enviar. Os
// campos opcionais ficam como texto vazio, que é o que o formulário produz.
export const findingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(TITLE_MIN, "O título precisa de pelo menos 3 caracteres")
    .max(TITLE_MAX, "O título tem no máximo 200 caracteres"),
  description: z
    .string()
    .trim()
    .min(10, "A descrição precisa de pelo menos 10 caracteres")
    .max(TEXT_MAX, "A descrição tem no máximo 10.000 caracteres"),
  severity: z.enum(
    SEVERITIES.map((item) => item.value),
    { error: "Escolha a severidade" },
  ),
  remediation: z
    .string()
    .trim()
    .max(TEXT_MAX, "A correção tem no máximo 10.000 caracteres"),
  // Vem de uma lista do catálogo.
  owaspCategory: z.string(),
  cwe: optionalCode(CWE_PATTERN, "Use o formato CWE-89"),
  cve: optionalCode(CVE_PATTERN, "Use o formato CVE-2024-12345"),
  // Campo de data: "" ou "AAAA-MM-DD".
  dueDate: z.string(),
  assetId: z.string(),
  assigneeId: z.string(),
})

export type FindingFormValues = z.infer<typeof findingSchema>

function emptyToNull(value: string): string | null {
  return value === "" ? null : value
}

export function toFindingBody(values: FindingFormValues): FindingBody {
  return {
    title: values.title,
    description: values.description,
    severity: values.severity,
    remediation: emptyToNull(values.remediation),
    owaspCategory: emptyToNull(values.owaspCategory),
    cwe: emptyToNull(values.cwe),
    cve: emptyToNull(values.cve),
    dueDate: emptyToNull(values.dueDate),
    assetId: emptyToNull(values.assetId),
    assigneeId: emptyToNull(values.assigneeId),
  }
}

// O caminho inverso, para abrir o formulário de edição já preenchido.
export function toFindingFormValues(finding: Finding): FindingFormValues {
  return {
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    remediation: finding.remediation ?? "",
    owaspCategory: finding.owaspCategory ?? "",
    cwe: finding.cwe ?? "",
    cve: finding.cve ?? "",
    // O back manda a data com hora; o campo de data quer só o dia.
    dueDate: finding.dueDate?.slice(0, 10) ?? "",
    assetId: finding.assetId ?? "",
    assigneeId: finding.assigneeId ?? "",
  }
}

// O que perguntar ao back sobre duplicatas, enquanto a pessoa ainda digita.
// Devolve null quando o título não daria para consultar. CWE ou CVE pela metade
// ficam de fora, senão o back responderia 400.
export function toDuplicatesParams(
  values: Pick<FindingFormValues, "title" | "assetId" | "cwe" | "cve">,
): DuplicatesParams | null {
  const title = values.title.trim()

  if (title.length < TITLE_MIN || title.length > TITLE_MAX) return null

  const cwe = values.cwe.trim().toUpperCase()
  const cve = values.cve.trim().toUpperCase()

  return {
    title,
    assetId: values.assetId || undefined,
    cwe: CWE_PATTERN.test(cwe) ? cwe : undefined,
    cve: CVE_PATTERN.test(cve) ? cve : undefined,
  }
}
