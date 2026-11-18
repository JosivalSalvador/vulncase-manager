import { Router, type Request, type Response } from "express"

import authRouter from "../resources/auth/auth.router.js"

export const routes: Router = Router()

routes.get("/health", (_req: Request, res: Response): void => {
  res.json({ status: "ok" })
})

routes.use("/auth", authRouter)
