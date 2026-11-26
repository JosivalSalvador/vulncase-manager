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
import { queryKeys } from "@/lib/query-keys"

const fetchMock = vi.fn<typeof fetch>()
const ana = { id: "1", email: "ana@a.com", fullname: "Ana", role: "ANALYST" }
const stats = {
  totals: {
    total: 12,
    open: 8,
    openCritical: 2,
    overdue: 4,
    stale: 3,
    staleDays: 30,
  },
  projects: [
    {
      id: "p1",
      name: "Portal do Aluno",
      total: 7,
      open: 5,
      openCritical: 1,
      overdue: 3,
    },
  ],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function respondStatsWith(response: () => Response) {
  fetchMock.mockImplementation((input) => {
    const { pathname } = new URL(input as string)

    return Promise.resolve(pathname === "/stats" ? response() : json(ana))
  })
}

function renderAt(path: string, queryClient = createQueryClient()) {
  render(
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
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

describe("dashboard", () => {
  it("mostra os números e a tabela de projetos", async () => {
    respondStatsWith(() => json(stats))

    renderAt("/")

    const link = await screen.findByRole("link", { name: "Portal do Aluno" })
    expect(link).toHaveAttribute("href", "/projects/p1")
    expect(
      screen.getByRole("row", { name: /Portal do Aluno/ }),
    ).toHaveTextContent("Portal do Aluno7513")
    expect(
      screen.getByText("Achados", { selector: "dt" }).parentElement,
    ).toHaveTextContent("12")
    expect(screen.getByText("Parados há 30+ dias")).toBeInTheDocument()
  })

  it("avisa quando a pessoa não participa de nenhum projeto", async () => {
    respondStatsWith(() => json({ ...stats, projects: [] }))

    renderAt("/")

    expect(
      await screen.findByText("Você ainda não participa de nenhum projeto."),
    ).toBeInTheDocument()
  })

  it("mostra o erro e permite tentar de novo", async () => {
    respondStatsWith(() => json({ error: "Dados inválidos" }, 400))
    renderAt("/")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados inválidos",
    )

    respondStatsWith(() => json(stats))
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    )

    expect(
      await screen.findByRole("link", { name: "Portal do Aluno" }),
    ).toBeInTheDocument()
  })

  it("quem entra não herda os números da sessão anterior", async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(queryKeys.overallStats, stats)
    fetchMock.mockImplementation((input) => {
      const { pathname } = new URL(input as string)

      if (pathname === "/csrf-token") {
        return Promise.resolve(json({ csrfToken: "t" }))
      }
      if (pathname === "/auth/login") return Promise.resolve(json(ana))

      return Promise.resolve(json({ error: "Não autenticado" }, 401))
    })
    renderAt("/login", queryClient)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText("E-mail"), "ana@a.com")
    await user.type(screen.getByLabelText("Senha"), "senhaSegura123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.overallStats)).toBeUndefined(),
    )
  })
})
