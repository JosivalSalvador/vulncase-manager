import type { z } from "zod"

import type { User } from "../../generated/prisma/client.js"
import type {
  listUsersQuerySchema,
  updateRoleSchema,
  userParamsSchema,
} from "./users.schema.js"

export type UserParams = z.infer<typeof userParamsSchema>

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

// Nunca inclui o hash da senha.
export type UserView = Pick<
  User,
  "id" | "fullname" | "email" | "role" | "createdAt"
>
