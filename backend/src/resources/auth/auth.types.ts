import type { z } from "zod"

import type { User } from "../../generated/prisma/client.js"
import type { loginSchema, registerSchema } from "./auth.schema.js"

export type RegisterInput = z.infer<typeof registerSchema>

export type LoginInput = z.infer<typeof loginSchema>

export type PublicUser = Pick<User, "id" | "email" | "fullname" | "role">
