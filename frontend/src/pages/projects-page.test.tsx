import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/app/routes"
import { ThemeProvider } from "@/components/theme-provider"
import { resetCsrfToken } from "@/lib/api"
import { createQueryClient } from "@/lib/query-client"

const fetchMock = vi.fn<typeof fetch>()
const ana = { id: "1", email: "ana@a.com", fullname: "Ana", role: "ANALYST" }
const portal = {
  id: "p1",
  name: "Portal RH",
  description: "Intranet do RH",
  ownerId: "1",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
}
const loja = { ...portal, id: "p2", name: "Loja Online", description: null }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function pageOf(
  projects: unknown[],
  meta: { page?: number; total?: number; totalPages?: number } = {},
) {
  return {
    data: projects,
    meta: {
      page: 1,
      pageSize: 10,
      total: projects.length,
      totalPages: projects.length > 0 ? 1 : 0,
      ...meta,
    },
  }
}

// Quem pede /projects recebe o que o teste mandar; o resto é a sessão (ana).
function respondProjectsWith(handler: (url: URL) => Response) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(input as string)

    return Promise.resolve(
      url.pathname === "/projects" ? handler(url) : json(ana),
    )
  })
}

function projectCalls() {
  return fetchMock.mock.calls
    .map(([url]) => new URL(url as string))
    .filter((url) => url.pathname === "/projects")
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

describe("lista de projetos", () => {
  it("mostra os projetos com link e descrição", async () => {
    respondProjectsWith(() => json(pageOf([portal, loja])))

    renderAt("/projects")

    const link = await screen.findByRole("link", { name: "Portal RH" })
    expect(link).toHaveAttribute("href", "/projects/p1")
    expect(screen.getByText("Intranet do RH")).toBeInTheDocument()
    expect(screen.getByText("Sem descrição")).toBeInTheDocument()
  })

  it("pede a primeira página, com 10 por página, quando a URL não diz nada", async () => {
    respondProjectsWith(() => json(pageOf([portal])))

    renderAt("/projects")

    await screen.findByRole("link", { name: "Portal RH" })
    const call = projectCalls()[0]
    expect(call?.searchParams.get("page")).toBe("1")
    expect(call?.searchParams.get("pageSize")).toBe("10")
    expect(call?.searchParams.has("search")).toBe(false)
  })

  it("lê a página e a busca da URL", async () => {
    respondProjectsWith(() =>
      json(pageOf([portal], { page: 3, total: 25, totalPages: 3 })),
    )

    renderAt("/projects?page=3&search=rh")

    await screen.findByRole("link", { name: "Portal RH" })
    const call = projectCalls()[0]
    expect(call?.searchParams.get("page")).toBe("3")
    expect(call?.searchParams.get("search")).toBe("rh")
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("rh")
  })

  it("espera parar de digitar, volta para a página 1 e guarda a busca na URL", async () => {
    respondProjectsWith(() =>
      json(pageOf([portal], { page: 2, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects?page=2")
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText("Buscar por nome"), "portal")

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?search=portal"),
    )
    await vi.waitFor(() => {
      const last = projectCalls().at(-1)
      expect(last?.searchParams.get("search")).toBe("portal")
      expect(last?.searchParams.get("page")).toBe("1")
    })
    // Nenhuma busca com o texto pela metade.
    expect(
      projectCalls().some((url) => url.searchParams.get("search") === "p"),
    ).toBe(false)
  })

  it("troca de página pelos botões e guarda a página na URL", async () => {
    respondProjectsWith((url) =>
      url.searchParams.get("page") === "2"
        ? json(pageOf([loja], { page: 2, total: 11, totalPages: 2 }))
        : json(pageOf([portal], { total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Próxima" }))

    expect(
      await screen.findByRole("link", { name: "Loja Online" }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe("?page=2")
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled()
  })

  it("avisa quando a página pedida não existe e leva para a primeira", async () => {
    respondProjectsWith(() =>
      json(pageOf([], { page: 3, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects?page=3")
    const user = userEvent.setup()

    expect(
      await screen.findByText("Nenhum projeto nesta página."),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    )

    expect(router.state.location.search).toBe("")
  })

  it("avisa quando não há projetos e quando a busca não acha nada", async () => {
    respondProjectsWith(() => json(pageOf([])))

    renderAt("/projects")
    expect(await screen.findByText("Nenhum projeto ainda.")).toBeInTheDocument()
  })

  it("mostra a busca sem resultado", async () => {
    respondProjectsWith(() => json(pageOf([])))

    renderAt("/projects?search=xyz")

    expect(
      await screen.findByText("Nenhum projeto encontrado para “xyz”."),
    ).toBeInTheDocument()
  })

  it("mostra o erro e permite tentar de novo", async () => {
    respondProjectsWith(() => json({ error: "Dados inválidos" }, 400))
    renderAt("/projects")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados inválidos",
    )

    respondProjectsWith(() => json(pageOf([portal])))
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    )

    expect(
      await screen.findByRole("link", { name: "Portal RH" }),
    ).toBeInTheDocument()
  })
})
