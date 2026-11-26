import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { resetCsrfToken } from "@/lib/api"
import { createQueryClient } from "@/lib/query-client"

import { initialsOf, isActivePath, navItemsFor } from "./navigation"
import { routes } from "./routes"

// Estes testes não olham os números do dashboard: a busca fica "carregando".
vi.mock("@/features/stats/use-overall-stats", () => ({
  useOverallStats: () => ({ isPending: true }),
}))

// Nem a lista de projetos: a busca também fica "carregando".
vi.mock("@/features/projects/use-projects", () => ({
  useProjects: () => ({ isPending: true }),
}))

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
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

const ana = (role: "ADMIN" | "ANALYST" | "VIEWER") => ({
  id: "1",
  email: "ana@exemplo.com",
  fullname: "Ana Souza",
  role,
})

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

describe("layout", () => {
  it("mostra o menu sem a área de admin para quem não é ADMIN", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(ana("ANALYST"))))

    renderAt("/")

    expect(await screen.findByRole("link", { name: "Projetos" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeVisible()
    expect(
      screen.queryByRole("link", { name: "Usuários" }),
    ).not.toBeInTheDocument()
  })

  it("mostra a área de admin no menu para o ADMIN", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(ana("ADMIN"))))

    renderAt("/")

    expect(await screen.findByRole("link", { name: "Usuários" })).toBeVisible()
  })

  it("mostra o nome e o papel de quem está logado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(ana("ANALYST"))))

    renderAt("/")

    expect(await screen.findByText("Ana Souza")).toBeVisible()
    expect(screen.getByText("Analista")).toBeVisible()
  })

  it("leva para a página ao clicar no item do menu", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(() => Promise.resolve(json(ana("VIEWER"))))

    const router = renderAt("/")

    await user.click(await screen.findByRole("link", { name: "Projetos" }))

    expect(router.state.location.pathname).toBe("/projects")
    expect(
      await screen.findByRole("heading", { name: "Projetos" }),
    ).toBeInTheDocument()
  })

  it("sai da conta e volta para o login", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const url = String(input)

      if (url.endsWith("/csrf-token")) {
        return Promise.resolve(json({ csrfToken: "t" }))
      }
      if (url.endsWith("/auth/logout") && init?.method === "POST") {
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      return Promise.resolve(json(ana("ANALYST")))
    })

    const router = renderAt("/")

    await user.click(await screen.findByRole("button", { name: /Ana Souza/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }))

    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/login")
    // Não guarda a página de quem saiu.
    expect(router.state.location.state).toBeNull()
  })

  it("avisa quando não consegue sair e continua logado", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const url = String(input)

      if (url.endsWith("/csrf-token")) {
        return Promise.resolve(json({ csrfToken: "t" }))
      }
      if (url.endsWith("/auth/logout") && init?.method === "POST") {
        return Promise.resolve(json({ error: "Erro interno" }, 500))
      }

      return Promise.resolve(json(ana("ANALYST")))
    })

    renderAt("/")

    await user.click(await screen.findByRole("button", { name: /Ana Souza/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível sair",
    )
    expect(
      screen.queryByRole("heading", { name: "Entrar" }),
    ).not.toBeInTheDocument()
  })
})

describe("navegação", () => {
  it("filtra os itens pelo papel", () => {
    expect(navItemsFor("VIEWER").map((item) => item.to)).toEqual([
      "/",
      "/projects",
    ])
    expect(navItemsFor("ADMIN").map((item) => item.to)).toEqual([
      "/",
      "/projects",
      "/admin/users",
    ])
  })

  it("marca o item ativo, inclusive nas páginas filhas", () => {
    expect(isActivePath("/", "/")).toBe(true)
    expect(isActivePath("/projects", "/")).toBe(false)
    expect(isActivePath("/projects/42", "/projects")).toBe(true)
    expect(isActivePath("/projects-antigos", "/projects")).toBe(false)
  })

  it("monta as iniciais do nome", () => {
    expect(initialsOf("Ana Souza")).toBe("AS")
    expect(initialsOf("  maria  clara  de  lima ")).toBe("ML")
    expect(initialsOf("Ana")).toBe("A")
    expect(initialsOf("")).toBe("")
  })
})
