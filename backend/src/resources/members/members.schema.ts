import { z } from "zod"

import { paginationSchema } from "../../utils/pagination.js"
import { emailSchema } from "../auth/auth.schema.js"

export const memberParamsSchema = z.object({
  projectId: z.uuid(),
  userId: z.uuid(),
})

export const listMembersQuerySchema = paginationSchema

export const addMemberSchema = z.object({
  email: emailSchema,
})
