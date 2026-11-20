import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import {
  createFindingService,
  deleteFindingService,
  getFindingService,
  listFindingsService,
  updateFindingService,
} from "./findings.service.js"
import type {
  CreateFindingInput,
  FindingParams,
  ListFindingsQuery,
  UpdateFindingInput,
} from "./findings.types.js"

type ProjectParams = Pick<FindingParams, "projectId">

export async function createFinding(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const finding = await createFindingService(
    getAuthUser(req),
    projectId,
    req.body as CreateFindingInput,
  )
  res.status(201).json(finding)
}

export async function listFindings(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const result = await listFindingsService(
    projectId,
    req.query as unknown as ListFindingsQuery,
  )
  res.json(result)
}

export async function getFinding(req: Request, res: Response): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  res.json(await getFindingService(projectId, findingId))
}

export async function updateFinding(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  const finding = await updateFindingService(
    projectId,
    findingId,
    req.body as UpdateFindingInput,
  )
  res.json(finding)
}

export async function deleteFinding(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  await deleteFindingService(getAuthUser(req), projectId, findingId)
  res.status(204).end()
}
