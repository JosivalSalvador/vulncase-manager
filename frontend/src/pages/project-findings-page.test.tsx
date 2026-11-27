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

// Prazos bem longe de hoje (2020 já passou, 2099 não chega), para o teste não
// depender do dia em que roda.
const sql = {
  id: "f1",
  title: "SQL Injection no login do portal",
  description: "O campo de matrícula é concatenado direto na consulta.",
  severity: "CRITICAL",
  status: "IN_PROGRESS",
  remediation: null,
  owaspCategory: "A03:2021",
  cwe: "CWE-89",
  cve: null,
  dueDate: "2020-01-01T00:00:00.000Z",
  projectId: "p1",
  assetId: "a1",
  reporterId: "1",
  assigneeId: "1",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  asset: { id: "a1", name: "Portal web", type: "WEB" },
  assignee: { id: "1", fullname: "Ana Ribeiro" },
  reporter: { id: "1", fullname: "Ana Ribeiro" },
}
const idor = {
  ...sql,
  id: "f2",
  title: "Aluno acessa as notas de outro pelo id na URL",
  severity: "HIGH",
  status: "OPEN",
  dueDate: "2099-12-31T00:00:00.000Z",
  assigneeId: "2",
  assignee: { id: "2", fullname: "Bruno Tavares" },
}
const headers = {
  ...sql,
  id: "f3",
  title: "Cabeçalhos de segurança ausentes",
  severity: "LOW",
  status: "FALSE_POSITIVE",
  dueDate: null,
  assetId: null,
  asset: null,
  assigneeId: null,
  assignee: null,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function pageOf(
  findings: unknown[],
  meta: { page?: number; total?: number; totalPages?: number } = {},
) {
  return {
    data: findings,
    meta: {
      page: 1,
      pageSize: 10,
      total: findings.length,
      totalPages: findings.length > 0 ? 1 : 0,
      ...meta,
    },
  }
}

// Quem pede os achados recebe o que o teste mandar, quem pede o projeto recebe o
// projeto; o resto é a sessão (ana).
function respondFindingsWith(
  handler: (url: URL) => Response,
  projectResponse: () => Response = () => json(project),
) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(input as string)

    if (url.pathname === "/projects/p1/findings") {
      return Promise.resolve(handler(url))
    }
    if (url.pathname === "/projects/p1") {
      return Promise.resolve(projectResponse())
    }

    return Promise.resolve(json(ana))
  })
}

function findingCalls() {
  return fetchMock.mock.calls
    .map(([url]) => new URL(url as string))
    .filter((url) => url.pathname === "/projects/p1/findings")
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

describe("lista de achados do projeto", () => {
  it("mostra severidade, status, ativo, responsável e prazo, e marca o vencido", async () => {
    respondFindingsWith(() => json(pageOf([sql, idor, headers])))

    renderAt("/projects/p1/findings")

    const table = await screen.findByRole("table")
    const sqlRow = within(table).getByRole("row", { name: /SQL Injection/ })
    expect(within(sqlRow).getByText("Crítica")).toBeInTheDocument()
    expect(within(sqlRow).getByText("Em correção")).toBeInTheDocument()
    expect(within(sqlRow).getByText("Portal web")).toBeInTheDocument()
    expect(within(sqlRow).getByText("Ana Ribeiro")).toBeInTheDocument()
    expect(within(sqlRow).getByText("01/01/2020")).toBeInTheDocument()
    expect(within(sqlRow).getByText("Vencido")).toBeInTheDocument()

    const idorRow = within(table).getByRole("row", { name: /Aluno acessa/ })
    expect(within(idorRow).getByText("Alta")).toBeInTheDocument()
    expect(within(idorRow).getByText("Aberto")).toBeInTheDocument()
    expect(within(idorRow).getByText("Bruno Tavares")).toBeInTheDocument()
    expect(within(idorRow).getByText("31/12/2099")).toBeInTheDocument()
    expect(within(idorRow).queryByText("Vencido")).not.toBeInTheDocument()

    const headersRow = within(table).getByRole("row", {
      name: /Cabeçalhos/,
    })
    expect(within(headersRow).getByText("Baixa")).toBeInTheDocument()
    expect(within(headersRow).getByText("Falso positivo")).toBeInTheDocument()
    expect(within(headersRow).getByText("Sem ativo")).toBeInTheDocument()
    expect(within(headersRow).getByText("Sem responsável")).toBeInTheDocument()
    expect(within(headersRow).getByText("Sem prazo")).toBeInTheDocument()

    expect(screen.getByRole("heading", { name: "Achados" })).toBeInTheDocument()
    expect(await screen.findByText("Portal do Aluno")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voltar para o projeto" }),
    ).toHaveAttribute("href", "/projects/p1")
  })

  it("mostra o total de achados, no singular e no plural", async () => {
    respondFindingsWith(() => json(pageOf([sql, idor, headers])))
    renderAt("/projects/p1/findings")
    expect(await screen.findByText("3 achados")).toBeInTheDocument()

    respondFindingsWith(() => json(pageOf([sql])))
    renderAt("/projects/p1/findings?severity=CRITICAL")
    expect(await screen.findByText("1 achado")).toBeInTheDocument()
  })

  it("pede a primeira página, com 10 por página e sem filtro, quando a URL não diz nada", async () => {
    respondFindingsWith(() => json(pageOf([sql])))

    renderAt("/projects/p1/findings")

    await screen.findByRole("rowheader", { name: /SQL Injection/ })
    const { searchParams } = findingCalls()[0] as URL
    expect([...searchParams.keys()].sort()).toEqual(["page", "pageSize"])
    expect(searchParams.get("page")).toBe("1")
    expect(searchParams.get("pageSize")).toBe("10")
  })

  it("lê a página, os filtros e a busca da URL", async () => {
    respondFindingsWith(() =>
      json(pageOf([sql], { page: 2, total: 11, totalPages: 2 })),
    )

    renderAt(
      "/projects/p1/findings?page=2&severity=HIGH&status=OPEN&overdue=true&stale=30&search=sql",
    )

    await screen.findByRole("rowheader", { name: /SQL Injection/ })
    const { searchParams } = findingCalls()[0] as URL
    expect(searchParams.get("page")).toBe("2")
    expect(searchParams.get("severity")).toBe("HIGH")
    expect(searchParams.get("status")).toBe("OPEN")
    expect(searchParams.get("overdue")).toBe("true")
    expect(searchParams.get("staleDays")).toBe("30")
    expect(searchParams.get("search")).toBe("sql")
    expect(screen.getByLabelText("Severidade")).toHaveValue("HIGH")
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN")
    expect(screen.getByLabelText("Parados")).toHaveValue("30")
    expect(screen.getByRole("checkbox", { name: "Só vencidos" })).toBeChecked()
    expect(screen.getByLabelText("Buscar por título")).toHaveValue("sql")
  })

  it("trata valores inválidos na URL como sem filtro", async () => {
    respondFindingsWith(() => json(pageOf([sql])))

    renderAt(
      "/projects/p1/findings?page=abc&severity=XYZ&status=ABC&overdue=1&stale=5",
    )

    await screen.findByRole("rowheader", { name: /SQL Injection/ })
    const { searchParams } = findingCalls()[0] as URL
    expect([...searchParams.keys()].sort()).toEqual(["page", "pageSize"])
    expect(searchParams.get("page")).toBe("1")
    expect(screen.getByLabelText("Severidade")).toHaveValue("")
    expect(screen.getByLabelText("Status")).toHaveValue("")
    expect(screen.getByLabelText("Parados")).toHaveValue("")
    expect(
      screen.getByRole("checkbox", { name: "Só vencidos" }),
    ).not.toBeChecked()
  })
})

describe("filtros da lista de achados", () => {
  it("trocar um filtro volta para a página 1 e guarda a escolha na URL", async () => {
    respondFindingsWith(() =>
      json(pageOf([sql], { page: 2, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/findings?page=2")
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText("Severidade"), "HIGH")

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?severity=HIGH"),
    )
    await vi.waitFor(() => {
      const last = findingCalls().at(-1)
      expect(last?.searchParams.get("severity")).toBe("HIGH")
      expect(last?.searchParams.get("page")).toBe("1")
    })
  })

  it("voltar o status para todos tira o filtro", async () => {
    respondFindingsWith(() => json(pageOf([sql])))
    const router = renderAt("/projects/p1/findings?status=FIXED")
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText("Status"), "")

    await vi.waitFor(() => expect(router.state.location.search).toBe(""))
    await vi.waitFor(() =>
      expect(findingCalls().at(-1)?.searchParams.has("status")).toBe(false),
    )
  })

  it("marca só vencidos", async () => {
    respondFindingsWith(() => json(pageOf([sql])))
    const router = renderAt("/projects/p1/findings")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("checkbox", { name: "Só vencidos" }),
    )

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?overdue=true"),
    )
    await vi.waitFor(() =>
      expect(findingCalls().at(-1)?.searchParams.get("overdue")).toBe("true"),
    )
  })

  it("desmarcar só vencidos tira o filtro", async () => {
    respondFindingsWith(() => json(pageOf([sql])))
    const router = renderAt("/projects/p1/findings?overdue=true")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("checkbox", { name: "Só vencidos" }),
    )

    await vi.waitFor(() => expect(router.state.location.search).toBe(""))
    await vi.waitFor(() =>
      expect(findingCalls().at(-1)?.searchParams.has("overdue")).toBe(false),
    )
  })

  it("filtra os parados e manda o número de dias", async () => {
    respondFindingsWith(() => json(pageOf([sql])))
    const router = renderAt("/projects/p1/findings")
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText("Parados"), "30")

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?stale=30"),
    )
    await vi.waitFor(() =>
      expect(findingCalls().at(-1)?.searchParams.get("staleDays")).toBe("30"),
    )
  })

  it("espera parar de digitar, volta para a página 1 e guarda a busca na URL", async () => {
    respondFindingsWith(() =>
      json(pageOf([sql], { page: 2, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/findings?page=2&severity=HIGH")
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText("Buscar por título"), "sql")

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?severity=HIGH&search=sql"),
    )
    await vi.waitFor(() => {
      const last = findingCalls().at(-1)
      expect(last?.searchParams.get("search")).toBe("sql")
      expect(last?.searchParams.get("page")).toBe("1")
      expect(last?.searchParams.get("severity")).toBe("HIGH")
    })
    // Nenhuma busca com o texto pela metade.
    expect(
      findingCalls().some((url) => url.searchParams.get("search") === "s"),
    ).toBe(false)
  })
})

describe("paginação e estados da lista de achados", () => {
  it("troca de página pelos botões e guarda a página na URL", async () => {
    respondFindingsWith((url) =>
      url.searchParams.get("page") === "2"
        ? json(pageOf([idor], { page: 2, total: 11, totalPages: 2 }))
        : json(pageOf([sql], { total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/findings")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Próxima" }))

    expect(
      await screen.findByRole("rowheader", { name: /Aluno acessa/ }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe("?page=2")
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled()
  })

  it("avisa quando a página pedida não existe e leva para a primeira", async () => {
    respondFindingsWith(() =>
      json(pageOf([], { page: 3, total: 11, totalPages: 2 })),
    )
    const router = renderAt("/projects/p1/findings?page=3")
    const user = userEvent.setup()

    expect(
      await screen.findByText("Nenhum achado nesta página."),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    )

    expect(router.state.location.search).toBe("")
  })

  it("avisa quando o projeto não tem achados", async () => {
    respondFindingsWith(() => json(pageOf([])))

    renderAt("/projects/p1/findings")

    expect(await screen.findByText("Nenhum achado ainda.")).toBeInTheDocument()
  })

  it("avisa quando o filtro não encontra nada", async () => {
    respondFindingsWith(() => json(pageOf([])))

    renderAt("/projects/p1/findings?status=VERIFIED")

    expect(
      await screen.findByText("Nenhum achado encontrado com esse filtro."),
    ).toBeInTheDocument()
  })

  it("mostra o erro e permite tentar de novo", async () => {
    respondFindingsWith(() => json({ error: "Dados inválidos" }, 400))
    renderAt("/projects/p1/findings")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados inválidos",
    )

    respondFindingsWith(() => json(pageOf([sql])))
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    )

    expect(
      await screen.findByRole("rowheader", { name: /SQL Injection/ }),
    ).toBeInTheDocument()
  })

  it("mostra o erro e o caminho de volta quando o projeto não abre", async () => {
    respondFindingsWith(
      () => json({ error: "Projeto não encontrado" }, 404),
      () => json({ error: "Projeto não encontrado" }, 404),
    )

    renderAt("/projects/p1/findings")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Projeto não encontrado",
    )
    expect(
      screen.getByRole("link", { name: "Voltar para os projetos" }),
    ).toBeInTheDocument()
  })
})
