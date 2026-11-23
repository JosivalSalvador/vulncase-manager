import type { z } from "zod"

import type {
  changeStatusSchema,
  createFindingSchema,
  duplicatesQuerySchema,
  findingParamsSchema,
  findingStatusSchema,
  listFindingsQuerySchema,
  listHistoryQuerySchema,
  updateFindingSchema,
} from "./findings.schema.js"

export type FindingParams = z.infer<typeof findingParamsSchema>

export type DuplicatesQuery = z.infer<typeof duplicatesQuerySchema>

export type ListFindingsQuery = z.infer<typeof listFindingsQuerySchema>

export type CreateFindingInput = z.infer<typeof createFindingSchema>

export type UpdateFindingInput = z.infer<typeof updateFindingSchema>

export type FindingStatus = z.infer<typeof findingStatusSchema>

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>

export type ListHistoryQuery = z.infer<typeof listHistoryQuerySchema>
