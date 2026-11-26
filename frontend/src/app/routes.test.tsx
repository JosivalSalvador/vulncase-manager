import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { ThemeProvider } from "@/components/theme-provider"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetCsrfToken } from "@/lib/api"
import { createQueryClient } from "@/lib/query-client"

import { routes } from "./routes"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function user(role: "ADMIN" | "ANALYST" | "VIEWER") {
  return { id: "1", email: "a@a.com", fullname: "Ana", role }
}

// Simula a resposta do GET /auth/me; as telas provisórias não chamam mais nada.
function respondMeWith(response: () => Response) {
  fetchMock.mockImplementation(() => Promise.resolve(response()))
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })

  render(
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  )

  return router
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

describe("rotas", () => {
  it("manda para o login quem não está logado", async () => {
    respondMeWith(() => json({ error: "Não autenticado" }, 401))

    const router = renderAt("/projects")

    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/login")
  })

  it("guarda a página pedida para o login poder voltar a ela", async () => {
    respondMeWith(() => json({ error: "Não autenticado" }, 401))

    const router = renderAt("/projects")

    await screen.findByRole("heading", { name: "Entrar" })

    expect(router.state.location.state).toMatchObject({
      from: { pathname: "/projects" },
    })
  })

  it("mostra a página para quem está logado", async () => {
    respondMeWith(() => json(user("VIEWER")))

    renderAt("/projects")

    expect(
      await screen.findByRole("heading", { name: "Projetos" }),
    ).toBeInTheDocument()
  })

  it("leva quem já está logado do login para o início", async () => {
    respondMeWith(() => json(user("ANALYST")))

    const router = renderAt("/login")

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/")
  })

  it("bloqueia a área de admin para quem não é ADMIN", async () => {
    respondMeWith(() => json(user("ANALYST")))

    renderAt("/admin/users")

    expect(
      await screen.findByRole("heading", { name: "Sem permissão" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Usuários" }),
    ).not.toBeInTheDocument()
  })

  it("libera a área de admin para o ADMIN", async () => {
    respondMeWith(() => json(user("ADMIN")))

    renderAt("/admin/users")

    expect(
      await screen.findByRole("heading", { name: "Usuários" }),
    ).toBeInTheDocument()
  })

  it("mostra a página 404 para endereços que não existem", async () => {
    respondMeWith(() => json(user("VIEWER")))

    renderAt("/nao-existe")

    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument()
  })

  it("mostra o erro, e não o login, quando o servidor não responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    renderAt("/projects")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar ao servidor",
    )
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Entrar" }),
    ).not.toBeInTheDocument()
  })
})
