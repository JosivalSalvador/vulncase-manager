import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import type { FindingParams } from "../findings/findings.types.js"
import {
  getOverallStatsService,
  getProjectStatsService,
} from "./stats.service.js"
import type { StatsQuery } from "./stats.types.js"

type ProjectParams = Pick<FindingParams, "projectId">

export async function getProjectStats(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId } = req.params as ProjectParams
  res.json(
    await getProjectStatsService(projectId, req.query as unknown as StatsQuery),
  )
}

export async function getOverallStats(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(
    await getOverallStatsService(
      getAuthUser(req),
      req.query as unknown as StatsQuery,
    ),
  )
}
