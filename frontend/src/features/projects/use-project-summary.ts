import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { fetchSummary } from "./api"

export function useProjectSummary(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectSummary(projectId),
    queryFn: ({ signal }) => fetchSummary(projectId, signal),
  })
}
