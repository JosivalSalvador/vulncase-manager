import { queryOptions, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

import type { OwaspEntry } from "./types"

// A mesma consulta serve aos gráficos e ao formulário: uma requisição só.
const owaspQuery = queryOptions({
  queryKey: queryKeys.owaspCatalog,
  queryFn: ({ signal }) =>
    api<{ data: OwaspEntry[] }>("/catalog/owasp", { signal }),
  // Lista fixa do back: não muda durante a sessão.
  staleTime: Infinity,
})

// Código -> nome em português, para os gráficos.
function toNameMap(response: { data: OwaspEntry[] }): Map<string, string> {
  return new Map(
    response.data.map((entry): [string, string] => [entry.code, entry.namePt]),
  )
}

export function useOwaspCatalog() {
  return useQuery({ ...owaspQuery, select: toNameMap })
}

// A lista inteira, para o campo de categoria do formulário.
export function useOwaspOptions() {
  return useQuery({ ...owaspQuery, select: (response) => response.data })
}
