import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { fetchCurrentUser } from "./api"

// data === undefined: ainda carregando. data === null: ninguém logado.
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60_000,
    retry: false,
  })
}
