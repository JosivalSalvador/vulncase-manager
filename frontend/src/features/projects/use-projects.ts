import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { listProjects, type ListProjectsParams } from "./api"

export function useProjects(params: ListProjectsParams) {
  return useQuery({
    queryKey: queryKeys.projectList(params),
    queryFn: ({ signal }) => listProjects(params, signal),
    placeholderData: keepPreviousData,
  })
}
