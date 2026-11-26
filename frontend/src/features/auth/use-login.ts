import { useMutation, useQueryClient } from "@tanstack/react-query"

import { login } from "./api"
import { startSession } from "./start-session"

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    // Com o usuário no cache, o PublicOnly sai do login sozinho.
    onSuccess: (user) => startSession(queryClient, user),
  })
}
