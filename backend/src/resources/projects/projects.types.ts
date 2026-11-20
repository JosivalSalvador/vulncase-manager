import type { z } from "zod"

import type {
  createProjectSchema,
  listProjectsQuerySchema,
  projectParamsSchema,
  updateProjectSchema,
} from "./projects.schema.js"

export type ProjectParams = z.infer<typeof projectParamsSchema>

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
