import type { z } from "zod"

import type {
  assetParamsSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
} from "./assets.schema.js"

export type AssetParams = z.infer<typeof assetParamsSchema>

export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>

export type CreateAssetInput = z.infer<typeof createAssetSchema>

export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
