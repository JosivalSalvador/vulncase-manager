import type { z } from "zod"

import type { PublicUser } from "../auth/auth.types.js"
import type {
  addMemberSchema,
  listMembersQuerySchema,
  memberParamsSchema,
} from "./members.schema.js"

export type MemberParams = z.infer<typeof memberParamsSchema>

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>

export type AddMemberInput = z.infer<typeof addMemberSchema>

export interface MemberView {
  userId: string
  fullname: string
  email: string
  role: PublicUser["role"]
  isOwner: boolean
  joinedAt: Date
}
