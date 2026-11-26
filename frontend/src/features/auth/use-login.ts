import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

import { login } from "./api"

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    // Com o usuário no cache, o PublicOnly sai do login sozinho.
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.currentUser, user)
    },
  })
}
