import type { QueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import type { User } from "./types"

// Quem entra começa com o cache vazio: se a sessão anterior expirou nesta
// aba, os dados da outra pessoa não podem reaparecer.
export function startSession(queryClient: QueryClient, user: User) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== queryKeys.currentUser[0],
  })
  queryClient.setQueryData(queryKeys.currentUser, user)
}
