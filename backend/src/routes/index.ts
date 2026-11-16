import { Router, type Request, type Response } from "express"

export const routes: Router = Router()

routes.get("/health", (_req: Request, res: Response): void => {
  res.json({ status: "ok" })
})