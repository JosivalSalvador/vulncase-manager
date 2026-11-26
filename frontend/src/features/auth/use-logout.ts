import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"

import { queryKeys } from "@/lib/query-keys"

import { logout } from "./api"

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Os dados da pessoa que saiu não ficam no cache do navegador.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== queryKeys.currentUser[0],
      })
      queryClient.setQueryData(queryKeys.currentUser, null)
      // Saída de propósito: vai ao login sem guardar a página atual, para a
      // próxima pessoa não cair onde a anterior estava.
      void navigate("/login", { replace: true, flushSync: true })
    },
  })
}
