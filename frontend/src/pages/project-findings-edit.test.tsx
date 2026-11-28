import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/app/routes"
import { ThemeProvider } from "@/components/theme-provider"
import { resetCsrfToken } from "@/lib/api"
import { createQueryClient } from "@/lib/query-client"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function pageOf(data: unknown[]) {
  return {
    data,
    meta: { page: 1, pageSize: 10, total: data.length, totalPages: 1 },
  }
}

const finding = {
  id: "f1",
  title: "SQL Injection no login",
  description: "O campo de login é concatenado na consulta.",
  severity: "HIGH",
  status: "OPEN",
  remediation: null,
  owaspCategory: "A03:2021",
  cwe: "CWE-89",
  cve: null,
  dueDate: "2099-12-31T00:00:00.000Z",
  projectId: "p1",
  assetId: "a1",
  reporterId: "2",
  assigneeId: "2",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
  asset: { id: "a1", name: "Portal web", type: "WEB" },
  assignee: { id: "2", fullname: "Bruno Tavares" },
  reporter: { id: "2", fullname: "Bruno Tavares" },
}

// Quem está logado é sempre o usuário "1"; o achado foi registrado pelo "2".
function setup({ role = "ANALYST", ownerId = "1" } = {}) {
  const responses: Record<string, unknown> = {
    "/auth/me": { id: "1", email: "a@a.com", fullname: "Ana", role },
    "/projects/p1": { id: "p1", name: "Portal do Aluno", ownerId },
    "/projects/p1/findings": pageOf([finding]),
    "/projects/p1/assets": pageOf([{ id: "a1", name: "Portal web" }]),
    "/projects/p1/members": pageOf([
      { userId: "2", fullname: "Bruno Tavares" },
    ]),
    "/catalog/owasp": {
      data: [{ code: "A03:2021", edition: "2021", namePt: "Injeção" }],
    },
    "/catalog/cwe": { data: [] },
    "/csrf-token": { csrfToken: "t" },
  }

  fetchMock.mockImplementation((input, init) => {
    const { pathname } = new URL(input as string)

    if (init?.method === "PATCH") return Promise.resolve(json(finding))
    if (init?.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }))
    }

    return Promise.resolve(json(responses[pathname]))
  })
}

function calls(method: "PATCH" | "DELETE") {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method)
}

function renderPage() {
  const router = createMemoryRouter(routes, {
    initialEntries: ["/projects/p1/findings"],
  })

  render(
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  )

  return userEvent.setup()
}

const editName = `Editar ${finding.title}`
const deleteName = `Excluir ${finding.title}`

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

describe("editar achado", () => {
  it("abre preenchido e salva com PATCH", async () => {
    setup()
    const user = renderPage()

    await user.click(await screen.findByRole("button", { name: editName }))
    const form = within(await screen.findByRole("dialog"))

    expect(await form.findByLabelText("Ativo")).toHaveValue("a1")
    expect(form.getByLabelText("Responsável")).toHaveValue("2")
    expect(form.getByLabelText("Categoria OWASP")).toHaveValue("A03:2021")
    expect(form.getByLabelText("Prazo")).toHaveValue("2099-12-31")

    await user.selectOptions(form.getByLabelText("Severidade"), "LOW")
    await user.click(form.getByRole("button", { name: "Salvar" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(JSON.parse(String(calls("PATCH")[0]?.[1]?.body))).toMatchObject({
      severity: "LOW",
      assetId: "a1",
      assigneeId: "2",
      owaspCategory: "A03:2021",
      dueDate: "2099-12-31",
    })
  })
})

describe("excluir achado", () => {
  it("o dono do projeto confirma e exclui", async () => {
    setup()
    const user = renderPage()

    await user.click(await screen.findByRole("button", { name: deleteName }))
    const dialog = within(await screen.findByRole("alertdialog"))
    await user.click(dialog.getByRole("button", { name: "Excluir" }))

    await waitFor(() => expect(calls("DELETE")).toHaveLength(1))
    expect(new URL(calls("DELETE")[0]?.[0] as string).pathname).toBe(
      "/projects/p1/findings/f1",
    )
  })

  it("analista que não registrou nem é dono só edita", async () => {
    setup({ ownerId: "9" })
    renderPage()

    expect(await screen.findByRole("button", { name: editName })).toBeVisible()
    expect(
      screen.queryByRole("button", { name: deleteName }),
    ).not.toBeInTheDocument()
  })

  it("ADMIN exclui mesmo sem ser dono", async () => {
    setup({ role: "ADMIN", ownerId: "9" })
    renderPage()

    expect(
      await screen.findByRole("button", { name: deleteName }),
    ).toBeVisible()
  })

  it("leitor não tem ações", async () => {
    setup({ role: "VIEWER" })
    renderPage()

    expect(await screen.findByText(finding.title)).toBeVisible()
    expect(
      screen.queryByRole("button", { name: editName }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: deleteName }),
    ).not.toBeInTheDocument()
  })
})
