import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { createAsset, deleteAsset, updateAsset } from "./api"
import type { AssetBody } from "./types"

// Criar, editar e excluir mudam as listas de ativos do projeto.
function refreshAssets(queryClient: QueryClient, projectId: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.projectAssets(projectId),
  })
}

// Os achados mostram o nome do ativo, e ficam sem ele quando é excluído.
function refreshAssetsAndFindings(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    refreshAssets(queryClient, projectId),
    queryClient.invalidateQueries({
      queryKey: queryKeys.projectFindings(projectId),
    }),
  ])
}

export function useCreateAsset(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AssetBody) => createAsset(projectId, body),
    onSuccess: () => refreshAssets(queryClient, projectId),
  })
}

export function useUpdateAsset(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AssetBody }) =>
      updateAsset(projectId, id, body),
    onSuccess: () => refreshAssetsAndFindings(queryClient, projectId),
  })
}

export function useDeleteAsset(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteAsset(projectId, id),
    onSuccess: () => refreshAssetsAndFindings(queryClient, projectId),
  })
}
