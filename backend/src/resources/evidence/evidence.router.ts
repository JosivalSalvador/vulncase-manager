import { Router } from "express"

import { requireRole } from "../../middlewares/requireRole.js"
import { validate } from "../../middlewares/validate.js"
import {
  downloadEvidence,
  listEvidence,
  uploadEvidence,
} from "./evidence.controller.js"
import { evidenceParamsSchema } from "./evidence.schema.js"
import { uploadSingleFile } from "./evidence.upload.js"

// mergeParams: faz este router enxergar :projectId e :findingId do router pai.
const evidenceRouter: Router = Router({ mergeParams: true })

const canWrite = requireRole("ADMIN", "ANALYST")

evidenceRouter.get("/", listEvidence)
// A permissão é conferida ANTES do multer ler o corpo da requisição.
evidenceRouter.post("/", canWrite, uploadSingleFile, uploadEvidence)
evidenceRouter.get(
  "/:evidenceId/download",
  validate({ params: evidenceParamsSchema }),
  downloadEvidence,
)

export default evidenceRouter
