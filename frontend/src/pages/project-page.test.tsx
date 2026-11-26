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

type Part = "project" | "stats" | "catalog"

const fetchMock = vi.fn<typeof fetch>()
const ana = { id: "1", email: "ana@a.com", fullname: "Ana", role: "ANALYST" }
const project = {
  id: "p1",
  name: "Portal RH",
  description: "Intranet do RH",
  ownerId: "1",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
}
const stats = {
  total: 9,
  open: 6,
  overdue: 2,
  stale: 1,
  staleDays: 30,
  bySeverity: { CRITICAL: 2, HIGH: 3, MEDIUM: 4, LOW: 0, INFO: 0 },
  openBySeverity: { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 0, INFO: 0 },
  byStatus: {
    OPEN: 4,
    IN_PROGRESS: 2,
    FIXED: 1,
    VERIFIED: 1,
    ACCEPTED_RISK: 1,
    FALSE_POSITIVE: 0,
  },
  byOwasp: [
    { category: "A03:2021", count: 4 },
    { category: "A01:2025", count: 1 },
  ],
}
const catalog = {
  data: [
    { code: "A03:2021", edition: "2021", name: "Injection", namePt: "Injeção" },
    {
      code: "A01:2025",
      edition: "2025",
      name: "Broken Access Control",
      namePt: "Quebra de Controle de Acesso",
    },
  ],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// Cada parte responde o padrão, a menos que o teste troque a resposta.
// (Erros 4xx: o cliente de consultas não tenta de novo.)
function respond(overrides: Partial<Record<Part, () => Response>> = {}) {
  const parts: Record<Part, () => Response> = {
    project: () => json(project),
    stats: () => json(stats),
    catalog: () => json(catalog),
    ...overrides,
  }

  fetchMock.mockImplementation((input) => {
    const { pathname } = new URL(input as string)

    if (pathname === "/projects/p1") return Promise.resolve(parts.project())
    if (pathname === "/projects/p1/stats") return Promise.resolve(parts.stats())
    if (pathname === "/catalog/owasp") return Promise.resolve(parts.catalog())

    return Promise.resolve(json(ana))
  })
}

function renderAt(path: string) {
  render(
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: [path] })}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  )
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

describe("painel do projeto", () => {
  it("mostra o projeto, os cartões e as contagens em texto", async () => {
    respond()

    renderAt("/projects/p1")

    expect(
      await screen.findByRole("heading", { name: "Portal RH" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Intranet do RH")).toBeInTheDocument()
    expect(
      await screen.findByText("Críticos abertos", { selector: "dt" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Críticos abertos", { selector: "dt" }).parentElement,
    ).toHaveTextContent("Críticos abertos1")
    expect(
      screen.getByText("Vencidos", { selector: "dt" }).parentElement,
    ).toHaveTextContent("Vencidos2")

    const severity = screen.getByRole("list", { name: "Por severidade" })
    expect(
      within(severity)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Crítica2", "Alta3", "Média4", "Baixa0", "Informativa0"])
  })

  it("mostra as categorias OWASP com o nome em português", async () => {
    respond()

    renderAt("/projects/p1")

    const owasp = await screen.findByRole("list", {
      name: "Por categoria OWASP",
    })
    await vi.waitFor(() =>
      expect(
        within(owasp)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        "A03:2021 · Injeção4",
        "A01:2025 · Quebra de Controle de Acesso1",
      ]),
    )
  })

  it("mostra só o código quando o catálogo falha, sem alerta", async () => {
    respond({ catalog: () => json({ error: "Sem permissão" }, 403) })

    renderAt("/projects/p1")

    expect(await screen.findByText("A03:2021")).toBeInTheDocument()
    expect(screen.queryByText(/Injeção/)).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("avisa quando nenhum achado tem categoria OWASP", async () => {
    respond({ stats: () => json({ ...stats, byOwasp: [] }) })

    renderAt("/projects/p1")

    expect(
      await screen.findByText("Nenhum achado com categoria OWASP."),
    ).toBeInTheDocument()
  })

  it("mostra o erro e o caminho de volta quando o projeto não abre", async () => {
    respond({ project: () => json({ error: "Projeto não encontrado" }, 404) })

    renderAt("/projects/p1")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Projeto não encontrado",
    )
    expect(
      screen.getByRole("link", { name: "Voltar para os projetos" }),
    ).toHaveAttribute("href", "/projects")
  })

  it("mostra o erro dos números e permite tentar de novo", async () => {
    respond({ stats: () => json({ error: "Dados inválidos" }, 400) })
    renderAt("/projects/p1")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados inválidos",
    )

    respond()
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    )

    expect(
      await screen.findByRole("list", { name: "Por status" }),
    ).toBeInTheDocument()
  })
})
