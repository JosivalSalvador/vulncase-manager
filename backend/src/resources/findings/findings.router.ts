import { Router } from "express"

import { requireRole } from "../../middlewares/requireRole.js"
import { validate } from "../../middlewares/validate.js"
import evidenceRouter from "../evidence/evidence.router.js"
import {
  changeFindingStatus,
  createFinding,
  deleteFinding,
  getFinding,
  listFindingHistory,
  listFindings,
  updateFinding,
} from "./findings.controller.js"
import {
  changeStatusSchema,
  createFindingSchema,
  findingParamsSchema,
  listFindingsQuerySchema,
  listHistoryQuerySchema,
  updateFindingSchema,
} from "./findings.schema.js"

// mergeParams: faz este router enxergar o :projectId definido no router pai.
const findingsRouter: Router = Router({ mergeParams: true })

const canWrite = requireRole("ADMIN", "ANALYST")
const params = validate({ params: findingParamsSchema })

findingsRouter.get(
  "/",
  validate({ query: listFindingsQuerySchema }),
  listFindings,
)
findingsRouter.post(
  "/",
  canWrite,
  validate({ body: createFindingSchema }),
  createFinding,
)
findingsRouter.get("/:findingId", params, getFinding)
findingsRouter.patch(
  "/:findingId",
  params,
  canWrite,
  validate({ body: updateFindingSchema }),
  updateFinding,
)
findingsRouter.delete("/:findingId", params, canWrite, deleteFinding)

findingsRouter.patch(
  "/:findingId/status",
  params,
  canWrite,
  validate({ body: changeStatusSchema }),
  changeFindingStatus,
)
findingsRouter.get(
  "/:findingId/history",
  params,
  validate({ query: listHistoryQuerySchema }),
  listFindingHistory,
)

// Evidências do achado: /projects/:projectId/findings/:findingId/evidence
findingsRouter.use("/:findingId/evidence", params, evidenceRouter)

export default findingsRouter
