import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  useDeleteAsset,
  useUpdateAsset,
} from "@/features/assets/use-asset-mutations"
import { useRemoveMember } from "@/features/members/use-member-mutations"
import { resetCsrfToken } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.test")
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ csrfToken: "t" }), {
        headers: { "content-type": "application/json" },
      }),
    ),
  )
  resetCsrfToken()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Roda a mutação e diz se as listas de achados dos dois projetos ficaram velhas.
async function staleAfter<T>(
  useHook: () => { mutateAsync: (input: T) => Promise<unknown> },
  input: T,
) {
  const client = new QueryClient()
  const own = queryKeys.findingList("p1", {})
  const other = queryKeys.findingList("p2", {})
  client.setQueryData(own, [])
  client.setQueryData(other, [])

  const { result } = renderHook(useHook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await result.current.mutateAsync(input)

  return [own, other].map((key) => client.getQueryState(key)?.isInvalidated)
}

describe("lista de achados depois de mexer em ativo ou membro", () => {
  it("excluir ativo atualiza só os achados do projeto", async () => {
    await expect(staleAfter(() => useDeleteAsset("p1"), "a1")).resolves.toEqual(
      [true, false],
    )
  })

  it("renomear ativo também", async () => {
    await expect(
      staleAfter(() => useUpdateAsset("p1"), {
        id: "a1",
        body: { name: "Portal", type: "WEB" as const, identifier: null },
      }),
    ).resolves.toEqual([true, false])
  })

  it("remover membro também", async () => {
    await expect(staleAfter(() => useRemoveMember("p1"), "2")).resolves.toEqual(
      [true, false],
    )
  })
})
