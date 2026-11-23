import { Router, type Request, type Response } from "express"

import { generateCsrfToken } from "../middlewares/csrf.js"
import authRouter from "../resources/auth/auth.router.js"
import catalogRouter from "../resources/catalog/catalog.router.js"
import projectsRouter from "../resources/projects/projects.router.js"
import { overallStatsRouter } from "../resources/stats/stats.router.js"
import usersRouter from "../resources/users/users.router.js"

export const routes: Router = Router()

routes.get("/health", (_req: Request, res: Response): void => {
  res.json({ status: "ok" })
})

routes.get("/csrf-token", (req: Request, res: Response): void => {
  res.json({ csrfToken: generateCsrfToken(req, res) })
})

routes.use("/auth", authRouter)
routes.use("/projects", projectsRouter)
routes.use("/stats", overallStatsRouter)
routes.use("/catalog", catalogRouter)
routes.use("/users", usersRouter)
