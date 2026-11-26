import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

import type { ProjectStats } from "./types"

export function useProjectStats(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectStats(projectId),
    queryFn: ({ signal }) =>
      api<ProjectStats>(`/projects/${projectId}/stats`, { signal }),
  })
}
