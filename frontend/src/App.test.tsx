import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import App from "./App"

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.test")
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("App", () => {
  it("sem sessão, abre a tela de login", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument()
  })
})
