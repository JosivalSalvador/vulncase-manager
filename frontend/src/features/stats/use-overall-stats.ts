import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

import type { OverallStats } from "./types"

export function useOverallStats() {
  return useQuery({
    queryKey: queryKeys.overallStats,
    queryFn: ({ signal }) => api<OverallStats>("/stats", { signal }),
  })
}
