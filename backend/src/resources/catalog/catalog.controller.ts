import type { Request, Response } from "express"

import { listCwe, listOwasp } from "./catalog.service.js"
import type { CweQuery, OwaspQuery } from "./catalog.types.js"

export function getOwasp(req: Request, res: Response): void {
  res.json({ data: listOwasp(req.query as unknown as OwaspQuery) })
}

export function getCwe(req: Request, res: Response): void {
  res.json({ data: listCwe(req.query as unknown as CweQuery) })
}
