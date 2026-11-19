import { Router, type Request, type Response } from "express"

import { generateCsrfToken } from "../middlewares/csrf.js"
import authRouter from "../resources/auth/auth.router.js"
import projectsRouter from "../resources/projects/projects.router.js"

export const routes: Router = Router()

routes.get("/health", (_req: Request, res: Response): void => {
  res.json({ status: "ok" })
})

routes.get("/csrf-token", (req: Request, res: Response): void => {
  res.json({ csrfToken: generateCsrfToken(req, res) })
})

routes.use("/auth", authRouter)
routes.use("/projects", projectsRouter)
