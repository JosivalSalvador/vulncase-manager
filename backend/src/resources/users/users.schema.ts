import { z } from "zod"

import { paginationSchema } from "../../utils/pagination.js"

export const roleSchema = z.enum(["ADMIN", "ANALYST", "VIEWER"])

export const userParamsSchema = z.object({
  userId: z.uuid(),
})

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  role: roleSchema.optional(),
})

export const updateRoleSchema = z.object({
  role: roleSchema,
})
