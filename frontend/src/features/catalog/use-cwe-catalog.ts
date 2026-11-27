import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

import type { CweEntry } from "./types"

// Sugestões de CWE para o formulário. O campo aceita qualquer "CWE-<número>".
export function useCweCatalog() {
  return useQuery({
    queryKey: queryKeys.cweCatalog,
    queryFn: ({ signal }) =>
      api<{ data: CweEntry[] }>("/catalog/cwe", { signal }),
    select: (response) => response.data,
    // Lista fixa do back: não muda durante a sessão.
    staleTime: Infinity,
  })
}
