import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, apiUrl, resetCsrfToken } from "@/lib/api"
import { ApiError } from "@/lib/api-error"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function call(index: number) {
  const entry = fetchMock.mock.calls[index]

  if (!entry) throw new Error(`Chamada ${index} não aconteceu`)

  const [url, init] = entry

  return {
    url: String(url),
    init: init ?? {},
    headers: new Headers(init?.headers),
  }
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.test")
  vi.stubGlobal("fetch", fetchMock)
  resetCsrfToken()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("api", () => {
  it("GET manda o cookie e não pede token CSRF", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }))

    const data = await api<{ ok: boolean }>("/projects")

    expect(data).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(call(0).url).toBe("http://api.test/projects")
    expect(call(0).init.credentials).toBe("include")
    expect(call(0).headers.has("X-CSRF-Token")).toBe(false)
  })

  it("monta a query ignorando valores vazios", () => {
    expect(
      apiUrl("/projects", { search: "web", page: 2, vazio: "", nulo: null }),
    ).toBe("http://api.test/projects?search=web&page=2")
  })

  it("POST busca o token CSRF uma vez e reaproveita nas próximas", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "token-1" }))
      .mockResolvedValueOnce(json({ id: "a" }, 201))
      .mockResolvedValueOnce(json({ id: "b" }, 201))

    await api("/projects", { method: "POST", body: { name: "A" } })
    await api("/projects", { method: "POST", body: { name: "B" } })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(call(0).url).toBe("http://api.test/csrf-token")
    expect(call(1).headers.get("X-CSRF-Token")).toBe("token-1")
    expect(call(1).headers.get("Content-Type")).toBe("application/json")
    expect(call(1).init.body).toBe(JSON.stringify({ name: "A" }))
    expect(call(2).headers.get("X-CSRF-Token")).toBe("token-1")
  })

  it("busca um token novo depois de resetCsrfToken", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "token-1" }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ csrfToken: "token-2" }))
      .mockResolvedValueOnce(json({}))

    await api("/auth/login", { method: "POST", body: {} })
    resetCsrfToken()
    await api("/projects", { method: "POST", body: {} })

    expect(call(3).headers.get("X-CSRF-Token")).toBe("token-2")
  })

  it("renova o token e repete uma vez quando o CSRF é recusado", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "velho" }))
      .mockResolvedValueOnce(
        json({ error: "Token CSRF inválido ou ausente" }, 403),
      )
      .mockResolvedValueOnce(json({ csrfToken: "novo" }))
      .mockResolvedValueOnce(json({ id: "a" }, 201))

    const data = await api<{ id: string }>("/projects", {
      method: "POST",
      body: {},
    })

    expect(data).toEqual({ id: "a" })
    expect(call(3).headers.get("X-CSRF-Token")).toBe("novo")
  })

  it("não repete em loop se o CSRF continuar sendo recusado", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "a" }))
      .mockResolvedValueOnce(
        json({ error: "Token CSRF inválido ou ausente" }, 403),
      )
      .mockResolvedValueOnce(json({ csrfToken: "b" }))
      .mockResolvedValueOnce(
        json({ error: "Token CSRF inválido ou ausente" }, 403),
      )

    await expect(
      api("/projects", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("transforma erro da API em ApiError com os detalhes", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          error: "Dados inválidos",
          details: [{ field: "email", message: "E-mail inválido" }],
        },
        400,
      ),
    )

    const error = await api("/projects").catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      message: "Dados inválidos",
      details: [{ field: "email", message: "E-mail inválido" }],
    })
  })

  it("devolve um erro genérico quando a resposta de erro não é JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }))

    await expect(api("/projects")).rejects.toMatchObject({
      status: 502,
      message: "Erro inesperado do servidor",
    })
  })

  it("trata 204 como resposta vazia", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(
      api("/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined()
  })

  it("manda FormData sem definir o Content-Type", async () => {
    const form = new FormData()
    form.append("file", new Blob(["x"]), "a.txt")
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(json({ id: "e" }, 201))

    await api("/evidence", { method: "POST", body: form })

    expect(call(1).init.body).toBe(form)
    expect(call(1).headers.has("Content-Type")).toBe(false)
  })

  it("falha de rede vira ApiError com status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(api("/projects")).rejects.toMatchObject({
      status: 0,
      message: "Não foi possível conectar ao servidor",
    })
  })

  it("avisa com clareza quando VITE_API_URL não está definida", async () => {
    vi.stubEnv("VITE_API_URL", "")

    await expect(api("/projects")).rejects.toThrow("VITE_API_URL")
  })
})
