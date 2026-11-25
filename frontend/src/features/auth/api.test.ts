import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetCsrfToken } from "@/lib/api"

import { fetchCurrentUser, login, logout } from "./api"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function calledUrls() {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

const user = {
  id: "1",
  email: "a@a.com",
  fullname: "Ana",
  role: "ANALYST",
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

describe("auth api", () => {
  it("fetchCurrentUser devolve o usuário logado", async () => {
    fetchMock.mockResolvedValueOnce(json(user))

    await expect(fetchCurrentUser()).resolves.toEqual(user)
  })

  it("fetchCurrentUser devolve null quando não há sessão (401)", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "Não autenticado" }, 401))

    await expect(fetchCurrentUser()).resolves.toBeNull()
  })

  it("fetchCurrentUser não esconde outros erros", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "Erro interno" }, 500))

    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 500 })
  })

  it("login e logout renovam o token CSRF, que depende da sessão", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "anonimo" }))
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(json({ csrfToken: "logado" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await login({ email: "a@a.com", password: "12345678" })
    await logout()

    expect(calledUrls()).toEqual([
      "http://api.test/csrf-token",
      "http://api.test/auth/login",
      "http://api.test/csrf-token",
      "http://api.test/auth/logout",
    ])
  })
})
