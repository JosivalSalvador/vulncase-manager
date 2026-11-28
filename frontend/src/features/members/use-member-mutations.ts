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

// Quem sai do projeto perde o acesso: buscar de novo o que é dele só daria erro.
// Por isso só marca como velho, sem refazer a busca agora. A lista de projetos
// e o dashboard buscam de novo quando a tela abrir.
function markStaleAfterLeaving(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects,
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.overallStats,
      refetchType: "none",
    }),
  ])
}

export function useAddMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AddMemberBody) => addMember(projectId, body),
    onSuccess: () => refreshMembers(queryClient, projectId),
  })
}

// Tirar outra pessoa do projeto (dono ou ADMIN). Os achados dela ficam sem
// responsável, então as listas de achados também mudam.
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeMember(projectId, userId),
    onSuccess: () =>
      Promise.all([
        refreshMembers(queryClient, projectId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectFindings(projectId),
        }),
      ]),
  })
}

// O próprio usuário saindo do projeto.
export function useLeaveProject(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeMember(projectId, userId),
    onSuccess: () => markStaleAfterLeaving(queryClient),
  })
}
