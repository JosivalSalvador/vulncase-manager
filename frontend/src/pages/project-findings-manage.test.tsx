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

const similar = {
  finding: { id: "f9", title: "SQL Injection no login do portal" },
  similarity: 0.75,
  reasons: ["Título parecido"],
}

function setup({
  role = "ANALYST",
  duplicates = [] as unknown[],
  post = () => json({ id: "f1", possibleDuplicates: [] }, 201),
} = {}) {
  const responses: Record<string, unknown> = {
    "/auth/me": { id: "1", email: "a@a.com", fullname: "Ana", role },
    "/projects/p1": { id: "p1", name: "Portal do Aluno", ownerId: "1" },
    "/projects/p1/findings": pageOf([]),
    "/projects/p1/findings/duplicates": { data: duplicates },
    "/projects/p1/assets": pageOf([{ id: "a1", name: "Portal web" }]),
    "/projects/p1/members": pageOf([{ userId: "1", fullname: "Ana Ribeiro" }]),
    "/catalog/owasp": { data: [] },
    "/catalog/cwe": { data: [] },
    "/csrf-token": { csrfToken: "t" },
  }

  fetchMock.mockImplementation((input, init) => {
    const { pathname } = new URL(input as string)

    if (init?.method === "POST") return Promise.resolve(post())

    return Promise.resolve(json(responses[pathname]))
  })
}

function posts() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")
}

function listCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => new URL(url as string).pathname === "/projects/p1/findings",
  ).length
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
}

async function openForm() {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole("button", { name: "Novo achado" }))
  const form = within(await screen.findByRole("dialog"))

  return { user, form }
}

async function fillRequired({
  user,
  form,
}: Awaited<ReturnType<typeof openForm>>) {
  await user.type(form.getByLabelText("Título"), "SQL Injection no login")
  await user.type(
    form.getByLabelText("Descrição"),
    "O campo de login é concatenado na consulta.",
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

describe("cadastro de achado", () => {
  it("leitor não vê o botão", async () => {
    setup({ role: "VIEWER" })
    renderPage()

    expect(await screen.findByText("Nenhum achado ainda.")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Novo achado" }),
    ).not.toBeInTheDocument()
  })

  it("valida antes de enviar", async () => {
    setup()
    const { user, form } = await openForm()

    await user.click(form.getByRole("button", { name: "Criar achado" }))

    expect(
      await form.findByText("O título precisa de pelo menos 3 caracteres"),
    ).toBeVisible()
    expect(
      form.getByText("A descrição precisa de pelo menos 10 caracteres"),
    ).toBeVisible()
    expect(posts()).toHaveLength(0)
  })

  it("cria, fecha o formulário e atualiza a lista", async () => {
    setup()
    const opened = await openForm()
    const { user, form } = opened

    await fillRequired(opened)
    await user.selectOptions(
      await form.findByLabelText("Ativo"),
      await form.findByRole("option", { name: "Portal web" }),
    )
    const before = listCalls()
    await user.click(form.getByRole("button", { name: "Criar achado" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(JSON.parse(String(posts()[0]?.[1]?.body))).toEqual({
      title: "SQL Injection no login",
      description: "O campo de login é concatenado na consulta.",
      severity: "MEDIUM",
      remediation: null,
      owaspCategory: null,
      cwe: null,
      cve: null,
      dueDate: null,
      assetId: "a1",
      assigneeId: null,
    })
    expect(listCalls()).toBeGreaterThan(before)
  })

  it("avisa sobre parecidos sem impedir de salvar", async () => {
    setup({ duplicates: [similar] })
    const opened = await openForm()
    const { user, form } = opened

    await fillRequired(opened)

    expect(
      await form.findByText("SQL Injection no login do portal"),
    ).toBeVisible()
    await user.click(form.getByRole("button", { name: "Criar achado" }))
    await waitFor(() => expect(posts()).toHaveLength(1))
  })

  it("mostra o erro do back e mantém o formulário aberto", async () => {
    setup({ post: () => json({ error: "Dados inválidos" }, 400) })
    const opened = await openForm()
    const { user, form } = opened

    await fillRequired(opened)
    await user.click(form.getByRole("button", { name: "Criar achado" }))

    expect(await form.findByRole("alert")).toHaveTextContent("Dados inválidos")
    expect(screen.getByRole("dialog")).toBeVisible()
  })
})
