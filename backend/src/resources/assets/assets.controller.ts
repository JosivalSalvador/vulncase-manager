import type { Request, Response } from "express"

import {
  createAssetService,
  deleteAssetService,
  getAssetService,
  listAssetsService,
  updateAssetService,
} from "./assets.service.js"
import type {
  AssetParams,
  CreateAssetInput,
  ListAssetsQuery,
  UpdateAssetInput,
} from "./assets.types.js"

type ProjectParams = Pick<AssetParams, "projectId">

export async function createAsset(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const asset = await createAssetService(
    projectId,
    req.body as CreateAssetInput,
  )
  res.status(201).json(asset)
}

export async function listAssets(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const result = await listAssetsService(
    projectId,
    req.query as unknown as ListAssetsQuery,
  )
  res.json(result)
}

export async function getAsset(req: Request, res: Response): Promise<void> {
  const { projectId, assetId } = req.params as AssetParams
  res.json(await getAssetService(projectId, assetId))
}

export async function updateAsset(req: Request, res: Response): Promise<void> {
  const { projectId, assetId } = req.params as AssetParams
  const asset = await updateAssetService(
    projectId,
    assetId,
    req.body as UpdateAssetInput,
  )
  res.json(asset)
}

export async function deleteAsset(req: Request, res: Response): Promise<void> {
  const { projectId, assetId } = req.params as AssetParams
  await deleteAssetService(projectId, assetId)
  res.status(204).end()
}
