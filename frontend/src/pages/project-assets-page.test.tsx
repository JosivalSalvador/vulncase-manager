import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
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
const project = {
  id: "p1",
  name: "Portal do Aluno",
  description: null,
  ownerId: "1",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
}
const portalWeb = {
  id: "a1",
  name: "Portal web",
  type: "WEB",
  identifier: "https://portal.exemplo.edu.br",
  projectId: "p1",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
}
const repo = {
  ...portalWeb,
  id: "a2",
  name: "Repositório portal-backend",
  type: "CODE",
  identifier: null,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function pageOf(
  assets: unknown[],
  meta: { page?: number; total?: number; totalPages?: number } = {},
) {
  return {
    data: assets,
    meta: {
      page: 1,
      pageSize: 10,
      total: assets.length,
      totalPages: assets.length > 0 ? 1 : 0,
      ...meta,
    },
  }
}

// Quem pede os ativos recebe o que o teste mandar, quem pede o projeto recebe
// o projeto; o resto é a sessão (ana).
function respondAssetsWith(
  handler: (url: URL) => Response,
  projectResponse: () => Response = () => json(project),
) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(input as string)

    if (url.pathname === "/projects/p1/assets") {
      return Promise.resolve(handler(url))
    }
    if (url.pathname === "/projects/p1") {
      return Promise.resolve(projectResponse())
    }

    return Promise.resolve(json(ana))
  })
}

function assetCalls() {
  return fetchMock.mock.calls
    .map(([url]) => new URL(url as string))
    .filter((url) => url.pathname === "/projects/p1/assets")
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

describe("lista de ativos do projeto", () => {
  it("mostra os ativos com tipo e identificador, e o caminho de volta", async () => {
    respondAssetsWith(() => json(pageOf([portalWeb, repo])))

    renderAt("/projects/p1/assets")

    const table = await screen.findByRole("table")
    expect(
      within(table).getByRole("rowheader", { name: "Portal web" }),
    ).toBeInTheDocument()
    expect(
      within(table).getByText("https://portal.exemplo.edu.br"),
    ).toBeInTheDocument()
    expect(within(table).getByText("Web")).toBeInTheDocument()
    expect(within(table).getByText("Código")).toBeInTheDocument()
    expect(within(table).getByText("Sem identificador")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Ativos" })).toBeInTheDocument()
    expect(await screen.findByText("Portal do Aluno")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voltar para o projeto" }),
    ).toHaveAttribute("href", "/projects/p1")
  })

  it("pede a primeira página, com 10 por página e sem filtros, quando a URL não diz nada", async () => {
    respondAssetsWith(() => json(pageOf([portalWeb])))

    renderAt("/projects/p1/assets")

    await screen.findByRole("rowheader", { name: "Portal web" })
    const call = assetCalls()[0]
    expect(call?.searchParams.get("page")).toBe("1")
    expect(call?.searchParams.get("pageSize")).toBe("10")
    expect(call?.searchParams.has("type")).toBe(false)
    expect(call?.searchParams.has("search")).toBe(false)
  })

  it("lê a página, o tipo e a busca da URL", async () => {
    respondAssetsWith(() =>
      json(pageOf([repo], { page: 3, total: 25, totalPages: 3 })),
    )

    renderAt("/projects/p1/assets?page=3&type=CODE&search=portal")

    await screen.findByRole("rowheader", { name: "Repositório portal-backend" })
    const call = assetCalls()[0]
    expect(call?.searchParams.get("page")).toBe("3")
    expect(call?.searchParams.get("type")).toBe("CODE")
    expect(call?.searchParams.get("search")).toBe("portal")
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("portal")
    expect(screen.getByRole("button", { name: "Código" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("trata um tipo inválido na URL como todos os tipos", async () => {
    respondAssetsWith(() => json(pageOf([portalWeb])))

    renderAt("/projects/p1/assets?type=abc")

    await screen.findByRole("rowheader", { name: "Portal web" })
    expect(assetCalls()[0]?.searchParams.has("type")).toBe(false)
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("filtra por tipo, volta para a página 1 e guarda o tipo na URL", async () => {
    respondAssetsWith(() =>
      json(pageOf([portalWeb], { page: 2, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/assets?page=2")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Rede" }))

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?type=NETWORK"),
    )
    await vi.waitFor(() => {
      const last = assetCalls().at(-1)
      expect(last?.searchParams.get("type")).toBe("NETWORK")
      expect(last?.searchParams.get("page")).toBe("1")
    })
    expect(screen.getByRole("button", { name: "Rede" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("o botão Todos tira o tipo da URL", async () => {
    respondAssetsWith(() => json(pageOf([repo])))
    const router = renderAt("/projects/p1/assets?type=CODE")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Todos" }))

    await vi.waitFor(() => expect(router.state.location.search).toBe(""))
    await vi.waitFor(() =>
      expect(assetCalls().at(-1)?.searchParams.has("type")).toBe(false),
    )
  })

  it("espera parar de digitar, volta para a página 1 e guarda a busca na URL", async () => {
    respondAssetsWith(() =>
      json(pageOf([portalWeb], { page: 2, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/assets?page=2&type=WEB")
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText("Buscar por nome"), "portal")

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?type=WEB&search=portal"),
    )
    await vi.waitFor(() => {
      const last = assetCalls().at(-1)
      expect(last?.searchParams.get("search")).toBe("portal")
      expect(last?.searchParams.get("page")).toBe("1")
      expect(last?.searchParams.get("type")).toBe("WEB")
    })
    // Nenhuma busca com o texto pela metade.
    expect(
      assetCalls().some((url) => url.searchParams.get("search") === "p"),
    ).toBe(false)
  })

  it("troca de página pelos botões e guarda a página na URL", async () => {
    respondAssetsWith((url) =>
      url.searchParams.get("page") === "2"
        ? json(pageOf([repo], { page: 2, total: 11, totalPages: 2 }))
        : json(pageOf([portalWeb], { total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Próxima" }))

    expect(
      await screen.findByRole("rowheader", {
        name: "Repositório portal-backend",
      }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe("?page=2")
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled()
  })

  it("avisa quando a página pedida não existe e leva para a primeira", async () => {
    respondAssetsWith(() =>
      json(pageOf([], { page: 3, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/assets?page=3")
    const user = userEvent.setup()

    expect(
      await screen.findByText("Nenhum ativo nesta página."),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    )

    expect(router.state.location.search).toBe("")
  })

  it("avisa quando o projeto não tem ativos", async () => {
    respondAssetsWith(() => json(pageOf([])))

    renderAt("/projects/p1/assets")

    expect(await screen.findByText("Nenhum ativo ainda.")).toBeInTheDocument()
  })

  it("avisa quando o filtro não acha nada", async () => {
    respondAssetsWith(() => json(pageOf([])))

    renderAt("/projects/p1/assets?type=NETWORK")

    expect(
      await screen.findByText("Nenhum ativo encontrado com esse filtro."),
    ).toBeInTheDocument()
  })

  it("mostra o erro e permite tentar de novo", async () => {
    respondAssetsWith(() => json({ error: "Dados inválidos" }, 400))
    renderAt("/projects/p1/assets")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados inválidos",
    )

    respondAssetsWith(() => json(pageOf([portalWeb])))
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    )

    expect(
      await screen.findByRole("rowheader", { name: "Portal web" }),
    ).toBeInTheDocument()
  })

  it("mostra o erro e o caminho de volta quando o projeto não abre", async () => {
    respondAssetsWith(
      () => json({ error: "Projeto não encontrado" }, 404),
      () => json({ error: "Projeto não encontrado" }, 404),
    )

    renderAt("/projects/p1/assets")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Projeto não encontrado",
    )
    expect(
      screen.getByRole("link", { name: "Voltar para os projetos" }),
    ).toBeInTheDocument()
  })
})
