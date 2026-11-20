import { z } from "zod"

import { paginationSchema } from "../../utils/pagination.js"

export const severitySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
])

export const findingStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "ACCEPTED_RISK",
  "FALSE_POSITIVE",
])

const titleSchema = z.string().trim().min(3).max(200)
const descriptionSchema = z.string().trim().min(10).max(10000)
const remediationSchema = z.string().trim().min(1).max(10000)

// Ex.: "A03:2021". Aceita minúscula e normaliza para maiúscula.
const owaspSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^A(0[1-9]|10):20\d{2}$/, "Use o formato A03:2021")

// Ex.: "CWE-89"
const cweSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^CWE-\d{1,5}$/, "Use o formato CWE-89")

// Ex.: "CVE-2024-12345"
const cveSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^CVE-\d{4}-\d{4,}$/, "Use o formato CVE-2024-12345")

// Ex.: "2026-12-31"
const dueDateSchema = z.iso.date().transform((value) => new Date(value))

export const findingParamsSchema = z.object({
  projectId: z.uuid(),
  findingId: z.uuid(),
})

export const listFindingsQuerySchema = paginationSchema.extend({
  severity: severitySchema.optional(),
  status: findingStatusSchema.optional(),
  assigneeId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
})

// Campos como status, reporterId e projectId NÃO entram aqui de propósito:
// o zod descarta o que não está no schema, e isso evita "mass assignment".
export const createFindingSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  severity: severitySchema,
  remediation: remediationSchema.nullable().default(null),
  owaspCategory: owaspSchema.nullable().default(null),
  cwe: cweSchema.nullable().default(null),
  cve: cveSchema.nullable().default(null),
  dueDate: dueDateSchema.nullable().default(null),
  assetId: z.uuid().nullable().default(null),
  assigneeId: z.uuid().nullable().default(null),
})

// Edição parcial. O status NÃO entra aqui: ele muda por um endpoint próprio,
// que também grava o histórico (passo 7).
export const updateFindingSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    severity: severitySchema,
    remediation: remediationSchema.nullable(),
    owaspCategory: owaspSchema.nullable(),
    cwe: cweSchema.nullable(),
    cve: cveSchema.nullable(),
    dueDate: dueDateSchema.nullable(),
    assetId: z.uuid().nullable(),
    assigneeId: z.uuid().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  })
