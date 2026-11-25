import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"

import { ApiError } from "@/lib/api-error"
import { queryKeys } from "@/lib/query-keys"

const MAX_RETRIES = 2

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

export function createQueryClient(): QueryClient {
  // Sessão expirou ou foi encerrada em outra aba: qualquer 401 zera o usuário
  // atual, e as rotas protegidas mandam para o login.
  const forgetUser = (error: unknown) => {
    if (isUnauthorized(error)) {
      queryClient.setQueryData(queryKeys.currentUser, null)
    }
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: forgetUser }),
    mutationCache: new MutationCache({ onError: forgetUser }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erro 4xx é resposta definitiva do back: repetir não adianta.
        retry: (failureCount, error) =>
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) && failureCount < MAX_RETRIES,
      },
    },
  })

  return queryClient
}

export const queryClient = createQueryClient()
