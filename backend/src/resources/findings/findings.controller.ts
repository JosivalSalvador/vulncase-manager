import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import {
  changeFindingStatusService,
  createFindingService,
  deleteFindingService,
  findPossibleDuplicatesService,
  getFindingService,
  listFindingHistoryService,
  listFindingsService,
  updateFindingService,
} from "./findings.service.js"
import type {
  ChangeStatusInput,
  CreateFindingInput,
  DuplicatesQuery,
  FindingParams,
  ListFindingsQuery,
  ListHistoryQuery,
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

export async function listPossibleDuplicates(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const data = await findPossibleDuplicatesService(
    projectId,
    req.query as unknown as DuplicatesQuery,
  )
  res.json({ data })
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

export async function changeFindingStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  const finding = await changeFindingStatusService(
    getAuthUser(req),
    projectId,
    findingId,
    req.body as ChangeStatusInput,
  )
  res.json(finding)
}

export async function listFindingHistory(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  const result = await listFindingHistoryService(
    projectId,
    findingId,
    req.query as unknown as ListHistoryQuery,
  )
  res.json(result)
}
