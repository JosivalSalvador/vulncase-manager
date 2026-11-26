import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { logout } from "./api"

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Os dados da pessoa que saiu não ficam no cache do navegador.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== queryKeys.currentUser[0],
      })
      queryClient.setQueryData(queryKeys.currentUser, null)
    },
  })
}
