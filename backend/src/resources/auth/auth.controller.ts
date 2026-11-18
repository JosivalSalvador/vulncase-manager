import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../middlewares/session.js"
import { loginService, registerService } from "./auth.service.js"
import type { LoginInput, RegisterInput } from "./auth.types.js"

function regenerateSession(req: Request): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    req.session.regenerate((error: unknown): void => {
      if (error) {
        reject(error instanceof Error ? error : new Error("Erro na sessão"))
        return
      }
      resolve()
    })
  })
}

function destroySession(req: Request): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    req.session.destroy((error: unknown): void => {
      if (error) {
        reject(error instanceof Error ? error : new Error("Erro na sessão"))
        return
      }
      resolve()
    })
  })
}

export async function register(req: Request, res: Response): Promise<void> {
  const user = await registerService(req.body as RegisterInput)
  res.status(201).json(user)
}

export async function login(req: Request, res: Response): Promise<void> {
  const user = await loginService(req.body as LoginInput)

  await regenerateSession(req)
  req.session.userId = user.id

  res.json(user)
}

export async function logout(req: Request, res: Response): Promise<void> {
  await destroySession(req)
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions)
  res.status(204).end()
}

export function me(req: Request, res: Response): void {
  res.json(getAuthUser(req))
}
