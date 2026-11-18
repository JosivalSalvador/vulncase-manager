import type { Request, RequestHandler } from "express"

import { getMeService } from "../resources/auth/auth.service.js"
import type { PublicUser } from "../resources/auth/auth.types.js"
import { AppError } from "../utils/AppError.js"

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = req.session.userId
  if (!userId) {
    throw new AppError(401, "Não autenticado")
  }

  req.user = await getMeService(userId)
  next()
}

export function getAuthUser(req: Request): PublicUser {
  if (!req.user) {
    throw new AppError(401, "Não autenticado")
  }
  return req.user
}
