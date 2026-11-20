import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import {
  createProjectService,
  deleteProjectService,
  getProjectService,
  listProjectsService,
  updateProjectService,
} from "./projects.service.js"
import type {
  CreateProjectInput,
  ListProjectsQuery,
  ProjectParams,
  UpdateProjectInput,
} from "./projects.types.js"

export async function createProject(
  req: Request,
  res: Response,
): Promise<void> {
  const project = await createProjectService(
    getAuthUser(req),
    req.body as CreateProjectInput,
  )
  res.status(201).json(project)
}

export async function listProjects(req: Request, res: Response): Promise<void> {
  const result = await listProjectsService(
    getAuthUser(req),
    req.query as unknown as ListProjectsQuery,
  )
  res.json(result)
}

export async function getProject(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  res.json(await getProjectService(projectId))
}

export async function updateProject(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const project = await updateProjectService(
    projectId,
    req.body as UpdateProjectInput,
  )
  res.json(project)
}

export async function deleteProject(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId } = req.params as ProjectParams
  await deleteProjectService(getAuthUser(req), projectId)
  res.status(204).end()
}
