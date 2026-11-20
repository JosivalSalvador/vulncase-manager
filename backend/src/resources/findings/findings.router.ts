import { Router } from "express"

import { requireRole } from "../../middlewares/requireRole.js"
import { validate } from "../../middlewares/validate.js"
import {
  createFinding,
  deleteFinding,
  getFinding,
  listFindings,
  updateFinding,
} from "./findings.controller.js"
import {
  createFindingSchema,
  findingParamsSchema,
  listFindingsQuerySchema,
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

export default findingsRouter
