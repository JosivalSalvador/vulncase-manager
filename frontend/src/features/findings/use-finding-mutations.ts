import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { createFinding, deleteFinding, updateFinding } from "./api"
import type { FindingBody } from "./types"

// Criar, editar e excluir mudam as listas de achados, os números do projeto
// (painel e resumo) e o dashboard geral.
function refreshFindings(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.projectFindings(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.projectNumbers(projectId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overallStats }),
  ])
}

export function useCreateFinding(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: FindingBody) => createFinding(projectId, body),
    onSuccess: () => refreshFindings(queryClient, projectId),
  })
}

export function useUpdateFinding(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FindingBody }) =>
      updateFinding(projectId, id, body),
    onSuccess: () => refreshFindings(queryClient, projectId),
  })
}

export function useDeleteFinding(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteFinding(projectId, id),
    onSuccess: () => refreshFindings(queryClient, projectId),
  })
}
