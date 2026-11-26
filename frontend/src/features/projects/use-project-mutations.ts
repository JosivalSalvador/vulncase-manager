import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { createProject, deleteProject, updateProject } from "./api"
import type { ProjectBody } from "./types"

// Criar, editar e excluir mudam as listas e os números do dashboard.
function refreshProjects(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overallStats }),
  ])
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: ProjectBody) => createProject(body),
    onSuccess: () => refreshProjects(queryClient),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProjectBody }) =>
      updateProject(id, body),
    onSuccess: () => refreshProjects(queryClient),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => refreshProjects(queryClient),
  })
}
