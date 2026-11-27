import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { listMembers, type ListMembersParams } from "./api"

export function useMembers(projectId: string, params: ListMembersParams) {
  return useQuery({
    queryKey: queryKeys.memberList(projectId, params),
    queryFn: ({ signal }) => listMembers(projectId, params, signal),
    // Mantém a lista anterior durante a troca de página, mas só dentro do
    // mesmo projeto (o id é o 3º item da chave).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === projectId ? previous : undefined,
  })
}
