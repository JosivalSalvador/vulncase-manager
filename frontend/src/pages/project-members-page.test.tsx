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
const anaRibeiro = {
  userId: "1",
  fullname: "Ana Ribeiro",
  email: "ana@vulncase.test",
  role: "ANALYST",
  isOwner: true,
  joinedAt: "2026-11-20T12:00:00.000Z",
}
const carla = {
  userId: "3",
  fullname: "Carla Nogueira",
  email: "carla@vulncase.test",
  role: "VIEWER",
  isOwner: false,
  joinedAt: "2026-11-21T12:00:00.000Z",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function pageOf(
  members: unknown[],
  meta: { page?: number; total?: number; totalPages?: number } = {},
) {
  return {
    data: members,
    meta: {
      page: 1,
      pageSize: 10,
      total: members.length,
      totalPages: members.length > 0 ? 1 : 0,
      ...meta,
    },
  }
}

// Quem pede os membros recebe o que o teste mandar, quem pede o projeto recebe
// o projeto; o resto é a sessão (ana).
function respondMembersWith(
  handler: (url: URL) => Response,
  projectResponse: () => Response = () => json(project),
) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(input as string)

    if (url.pathname === "/projects/p1/members") {
      return Promise.resolve(handler(url))
    }
    if (url.pathname === "/projects/p1") {
      return Promise.resolve(projectResponse())
    }

    return Promise.resolve(json(ana))
  })
}

function memberCalls() {
  return fetchMock.mock.calls
    .map(([url]) => new URL(url as string))
    .filter((url) => url.pathname === "/projects/p1/members")
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

describe("lista de membros do projeto", () => {
  it("mostra os membros com e-mail, papel e data, marca o dono e tem o caminho de volta", async () => {
    respondMembersWith(() => json(pageOf([anaRibeiro, carla])))

    renderAt("/projects/p1/members")

    const table = await screen.findByRole("table")
    const anaRow = within(table).getByRole("row", { name: /Ana Ribeiro/ })
    expect(within(anaRow).getByText("Dono")).toBeInTheDocument()
    expect(within(anaRow).getByText("ana@vulncase.test")).toBeInTheDocument()
    expect(within(anaRow).getByText("Analista")).toBeInTheDocument()
    expect(within(anaRow).getByText("20/11/2026")).toBeInTheDocument()

    const carlaRow = within(table).getByRole("row", { name: /Carla Nogueira/ })
    expect(within(carlaRow).getByText("Leitor")).toBeInTheDocument()
    expect(within(carlaRow).queryByText("Dono")).not.toBeInTheDocument()

    expect(screen.getByRole("heading", { name: "Membros" })).toBeInTheDocument()
    expect(await screen.findByText("Portal do Aluno")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voltar para o projeto" }),
    ).toHaveAttribute("href", "/projects/p1")
  })

  it("pede a primeira página, com 10 por página, quando a URL não diz nada", async () => {
    respondMembersWith(() => json(pageOf([anaRibeiro])))

    renderAt("/projects/p1/members")

    await screen.findByRole("rowheader", { name: /Ana Ribeiro/ })
    const call = memberCalls()[0]
    expect(call?.searchParams.get("page")).toBe("1")
    expect(call?.searchParams.get("pageSize")).toBe("10")
  })

  it("lê a página da URL", async () => {
    respondMembersWith(() =>
      json(pageOf([carla], { page: 3, total: 25, totalPages: 3 })),
    )

    renderAt("/projects/p1/members?page=3")

    await screen.findByRole("rowheader", { name: /Carla Nogueira/ })
    expect(memberCalls()[0]?.searchParams.get("page")).toBe("3")
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument()
  })

  it("trata uma página inválida na URL como a primeira", async () => {
    respondMembersWith(() => json(pageOf([anaRibeiro])))

    renderAt("/projects/p1/members?page=abc")

    await screen.findByRole("rowheader", { name: /Ana Ribeiro/ })
    expect(memberCalls()[0]?.searchParams.get("page")).toBe("1")
  })

  it("troca de página pelos botões e guarda a página na URL", async () => {
    respondMembersWith((url) =>
      url.searchParams.get("page") === "2"
        ? json(pageOf([carla], { page: 2, total: 11, totalPages: 2 }))
        : json(pageOf([anaRibeiro], { total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Próxima" }))

    expect(
      await screen.findByRole("rowheader", { name: /Carla Nogueira/ }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe("?page=2")
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled()
  })

  it("avisa quando a página pedida não existe e leva para a primeira", async () => {
    respondMembersWith(() =>
      json(pageOf([], { page: 3, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/members?page=3")
    const user = userEvent.setup()

    expect(
      await screen.findByText("Nenhum membro nesta página."),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    )

    expect(router.state.location.search).toBe("")
  })

  it("avisa quando o projeto não tem membros", async () => {
    respondMembersWith(() => json(pageOf([])))

    renderAt("/projects/p1/members")

    expect(await screen.findByText("Nenhum membro ainda.")).toBeInTheDocument()
  })

  it("mostra o erro e permite tentar de novo", async () => {
    respondMembersWith(() => json({ error: "Dados inválidos" }, 400))
    renderAt("/projects/p1/members")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados inválidos",
    )

    respondMembersWith(() => json(pageOf([anaRibeiro])))
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    )

    expect(
      await screen.findByRole("rowheader", { name: /Ana Ribeiro/ }),
    ).toBeInTheDocument()
  })

  it("mostra o erro e o caminho de volta quando o projeto não abre", async () => {
    respondMembersWith(
      () => json({ error: "Projeto não encontrado" }, 404),
      () => json({ error: "Projeto não encontrado" }, 404),
    )

    renderAt("/projects/p1/members")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Projeto não encontrado",
    )
    expect(
      screen.getByRole("link", { name: "Voltar para os projetos" }),
    ).toBeInTheDocument()
  })
})
