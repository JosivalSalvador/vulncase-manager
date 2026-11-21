import { z } from "zod"

export const owaspQuerySchema = z.object({
  edition: z.enum(["2021", "2025"]).optional(),
})

export const cweQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
})
