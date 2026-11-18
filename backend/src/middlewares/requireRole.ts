import type { RequestHandler } from "express"

import type { PublicUser } from "../resources/auth/auth.types.js"
import { AppError } from "../utils/AppError.js"
import { getAuthUser } from "./requireAuth.js"

type Role = PublicUser["role"]

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next): void => {
    const user = getAuthUser(req)
    if (!roles.includes(user.role)) {
      throw new AppError(403, "Sem permissão")
    }
    next()
  }
}
