import { Router } from "express"

import { requireAuth } from "../../middlewares/requireAuth.js"
import { validate } from "../../middlewares/validate.js"
import { getOverallStats, getProjectStats } from "./stats.controller.js"
import { statsQuerySchema } from "./stats.schema.js"

const query = validate({ query: statsQuerySchema })

// GET /stats: visão geral de todos os projetos do usuário.
export const overallStatsRouter: Router = Router()
overallStatsRouter.use(requireAuth)
overallStatsRouter.get("/", query, getOverallStats)

// GET /projects/:projectId/stats: números de um projeto.
// mergeParams: faz este router enxergar o :projectId definido no router pai.
export const projectStatsRouter: Router = Router({ mergeParams: true })
projectStatsRouter.get("/", query, getProjectStats)
