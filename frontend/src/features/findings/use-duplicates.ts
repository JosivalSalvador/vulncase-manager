import { skipToken, useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { listDuplicates, type DuplicatesParams } from "./api"

// Com params null (título curto), nada é consultado.
export function useDuplicates(
  projectId: string,
  params: DuplicatesParams | null,
) {
  return useQuery({
    queryKey: queryKeys.findingDuplicates(projectId, params),
    queryFn: params
      ? ({ signal }) => listDuplicates(projectId, params, signal)
      : skipToken,
    select: (response) => response.data,
    // A resposta envelhece assim que alguém cadastra um achado.
    staleTime: 0,
  })
}
