import { api } from "@/lib/api"
import type { Paginated } from "@/lib/pagination"

import type { AssetType } from "./labels"
import type { Asset, AssetBody } from "./types"

export type ListAssetsParams = {
  page?: number
  pageSize?: number
  type?: AssetType
  search?: string
}

// Tipo e busca vazios são omitidos da URL pelo cliente da API.
export function listAssets(
  projectId: string,
  params: ListAssetsParams,
  signal?: AbortSignal,
) {
  return api<Paginated<Asset>>(`/projects/${projectId}/assets`, {
    query: params,
    signal,
  })
}

export function createAsset(projectId: string, body: AssetBody) {
  return api<Asset>(`/projects/${projectId}/assets`, {
    method: "POST",
    body,
  })
}

export function updateAsset(
  projectId: string,
  assetId: string,
  body: AssetBody,
) {
  return api<Asset>(`/projects/${projectId}/assets/${assetId}`, {
    method: "PATCH",
    body,
  })
}

export function deleteAsset(projectId: string, assetId: string) {
  return api(`/projects/${projectId}/assets/${assetId}`, {
    method: "DELETE",
  })
}
