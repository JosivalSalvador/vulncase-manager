import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { fetchProject } from "./api"

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectDetail(projectId),
    queryFn: ({ signal }) => fetchProject(projectId, signal),
  })
}
