import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { addMember, removeMember } from "./api"
import type { AddMemberBody } from "./types"

// Adicionar e remover mudam as listas de membros do projeto.
function refreshMembers(queryClient: QueryClient, projectId: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.projectMembers(projectId),
  })
}

export function useAddMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AddMemberBody) => addMember(projectId, body),
    onSuccess: () => refreshMembers(queryClient, projectId),
  })
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeMember(projectId, userId),
    onSuccess: () => refreshMembers(queryClient, projectId),
  })
}
