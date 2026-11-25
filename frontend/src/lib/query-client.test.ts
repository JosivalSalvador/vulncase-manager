import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api-error"
import { createQueryClient } from "@/lib/query-client"
import { queryKeys } from "@/lib/query-keys"

const user = {
  id: "1",
  email: "a@a.com",
  fullname: "Ana",
  role: "ANALYST" as const,
}

describe("createQueryClient", () => {
  it("zera o usuário atual quando uma consulta volta 401", async () => {
    const client = createQueryClient()
    client.setQueryData(queryKeys.currentUser, user)

    await client
      .fetchQuery({
        queryKey: ["projects"],
        queryFn: () => Promise.reject(new ApiError(401, "Não autenticado")),
        retry: false,
      })
      .catch(() => undefined)

    expect(client.getQueryData(queryKeys.currentUser)).toBeNull()
  })

  it("mantém o usuário quando o erro não é 401", async () => {
    const client = createQueryClient()
    client.setQueryData(queryKeys.currentUser, user)

    await client
      .fetchQuery({
        queryKey: ["projects"],
        queryFn: () => Promise.reject(new ApiError(500, "Erro")),
        retry: false,
      })
      .catch(() => undefined)

    expect(client.getQueryData(queryKeys.currentUser)).toEqual(user)
  })

  it("não repete consultas que o back recusou com erro 4xx", () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry

    expect(typeof retry).toBe("function")
    if (typeof retry !== "function") return

    expect(retry(0, new ApiError(404, "Não encontrado"))).toBe(false)
    expect(retry(0, new ApiError(500, "Erro"))).toBe(true)
    expect(retry(0, new ApiError(0, "Sem conexão"))).toBe(true)
    expect(retry(2, new ApiError(500, "Erro"))).toBe(false)
  })
})
