import type { Request, Response } from "express"

import type { FindingParams } from "../findings/findings.types.js"
import { buildSummaryService } from "./summary.service.js"
import type { SummaryQuery } from "./summary.types.js"

type ProjectParams = Pick<FindingParams, "projectId">

export async function getSummary(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  res.json(
    await buildSummaryService(projectId, req.query as unknown as SummaryQuery),
  )
}
