import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import { listUsersService, updateUserRoleService } from "./users.service.js"
import type {
  ListUsersQuery,
  UpdateRoleInput,
  UserParams,
} from "./users.types.js"

export async function listUsers(req: Request, res: Response): Promise<void> {
  res.json(await listUsersService(req.query as unknown as ListUsersQuery))
}

export async function updateUserRole(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = req.params as UserParams
  const user = await updateUserRoleService(
    getAuthUser(req),
    userId,
    req.body as UpdateRoleInput,
  )
  res.json(user)
}
