import { Router } from "express"

import { requireAuth } from "../../middlewares/requireAuth.js"
import { requireProjectAccess } from "../../middlewares/requireProjectAccess.js"
import { requireRole } from "../../middlewares/requireRole.js"
import { validate } from "../../middlewares/validate.js"
import assetsRouter from "../assets/assets.router.js"
import membersRouter from "../members/members.router.js"
import findingsRouter from "../findings/findings.router.js"
import { projectStatsRouter } from "../stats/stats.router.js"
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./projects.controller.js"
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectParamsSchema,
  updateProjectSchema,
} from "./projects.schema.js"

const projectsRouter: Router = Router()

const canWrite = requireRole("ADMIN", "ANALYST")
const params = validate({ params: projectParamsSchema })

// Todas as rotas de projetos exigem login.
projectsRouter.use(requireAuth)

projectsRouter.get(
  "/",
  validate({ query: listProjectsQuerySchema }),
  listProjects,
)
projectsRouter.post(
  "/",
  canWrite,
  validate({ body: createProjectSchema }),
  createProject,
)

projectsRouter.get("/:projectId", params, requireProjectAccess, getProject)
projectsRouter.patch(
  "/:projectId",
  params,
  requireProjectAccess,
  canWrite,
  validate({ body: updateProjectSchema }),
  updateProject,
)
projectsRouter.delete(
  "/:projectId",
  params,
  requireProjectAccess,
  canWrite,
  deleteProject,
)

// Ativos do projeto: /projects/:projectId/assets
projectsRouter.use(
  "/:projectId/assets",
  params,
  requireProjectAccess,
  assetsRouter,
)

// Membros do projeto: /projects/:projectId/members
projectsRouter.use(
  "/:projectId/members",
  params,
  requireProjectAccess,
  membersRouter,
)

// Achados do projeto: /projects/:projectId/findings
projectsRouter.use(
  "/:projectId/findings",
  params,
  requireProjectAccess,
  findingsRouter,
)

// Números do projeto: /projects/:projectId/stats
projectsRouter.use(
  "/:projectId/stats",
  params,
  requireProjectAccess,
  projectStatsRouter,
)

export default projectsRouter
