import { Router } from "express"

import { requireRole } from "../../middlewares/requireRole.js"
import { validate } from "../../middlewares/validate.js"
import {
  createAsset,
  deleteAsset,
  getAsset,
  listAssets,
  updateAsset,
} from "./assets.controller.js"
import {
  assetParamsSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
} from "./assets.schema.js"

// mergeParams: faz este router enxergar o :projectId definido no router pai.
const assetsRouter: Router = Router({ mergeParams: true })

const canWrite = requireRole("ADMIN", "ANALYST")
const params = validate({ params: assetParamsSchema })

assetsRouter.get("/", validate({ query: listAssetsQuerySchema }), listAssets)
assetsRouter.post(
  "/",
  canWrite,
  validate({ body: createAssetSchema }),
  createAsset,
)

assetsRouter.get("/:assetId", params, getAsset)
assetsRouter.patch(
  "/:assetId",
  params,
  canWrite,
  validate({ body: updateAssetSchema }),
  updateAsset,
)
assetsRouter.delete("/:assetId", params, canWrite, deleteAsset)

export default assetsRouter
