import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { listFindings, type ListFindingsParams } from "./api"

export function useFindings(projectId: string, params: ListFindingsParams) {
  return useQuery({
    queryKey: queryKeys.findingList(projectId, params),
    queryFn: ({ signal }) => listFindings(projectId, params, signal),
    // Mantém a lista anterior durante a troca de página ou de filtro, mas só
    // dentro do mesmo projeto (o id é o 3º item da chave).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === projectId ? previous : undefined,
  })
}
