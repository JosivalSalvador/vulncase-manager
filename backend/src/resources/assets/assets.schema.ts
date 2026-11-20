import { z } from "zod"

import { paginationSchema } from "../../utils/pagination.js"

export const assetTypeSchema = z.enum(["WEB", "MOBILE", "NETWORK", "CODE"])

const nameSchema = z.string().trim().min(2).max(120)
// URL, IP, nome do pacote, repositório...
const identifierSchema = z.string().trim().min(1).max(255)

export const assetParamsSchema = z.object({
  projectId: z.uuid(),
  assetId: z.uuid(),
})

export const listAssetsQuerySchema = paginationSchema.extend({
  type: assetTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
})

export const createAssetSchema = z.object({
  name: nameSchema,
  type: assetTypeSchema,
  identifier: identifierSchema.nullable().default(null),
})

export const updateAssetSchema = z
  .object({
    name: nameSchema,
    type: assetTypeSchema,
    identifier: identifierSchema.nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  })
