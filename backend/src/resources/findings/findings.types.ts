import type { z } from "zod"

import type {
  createFindingSchema,
  findingParamsSchema,
  listFindingsQuerySchema,
  updateFindingSchema,
} from "./findings.schema.js"

export type FindingParams = z.infer<typeof findingParamsSchema>

export type ListFindingsQuery = z.infer<typeof listFindingsQuerySchema>

export type CreateFindingInput = z.infer<typeof createFindingSchema>

export type UpdateFindingInput = z.infer<typeof updateFindingSchema>
