import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { listAssets, type ListAssetsParams } from "./api"

export function useAssets(projectId: string, params: ListAssetsParams) {
  return useQuery({
    queryKey: queryKeys.assetList(projectId, params),
    queryFn: ({ signal }) => listAssets(projectId, params, signal),
    // Mantém a lista anterior durante a troca de página ou de filtro, mas só
    // dentro do mesmo projeto (o id é o 3º item da chave).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === projectId ? previous : undefined,
  })
}
