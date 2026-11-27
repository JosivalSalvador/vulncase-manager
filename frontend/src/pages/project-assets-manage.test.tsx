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

type Role = "ADMIN" | "ANALYST" | "VIEWER"
type Method = "POST" | "PATCH" | "DELETE"

const fetchMock = vi.fn<typeof fetch>()

function person(role: Role, id = "1") {
  return { id, email: "a@a.com", fullname: "Ana", role }
}

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

// Sessão, projeto, lista e escritas. Cada teste pode trocar a resposta de uma
// escrita.
function setup(
  me: ReturnType<typeof person>,
  overrides: Partial<Record<Method, () => Response>> = {},
) {
  fetchMock.mockImplementation((input, init) => {
    const { pathname } = new URL(input as string)
    const method = init?.method ?? "GET"

    if (pathname === "/csrf-token") {
      return Promise.resolve(json({ csrfToken: "t" }))
    }
    if (pathname === "/auth/me") return Promise.resolve(json(me))
    if (method === "GET" && pathname === "/projects/p1") {
      return Promise.resolve(json(project))
    }
    if (method === "GET" && pathname === "/projects/p1/assets") {
      return Promise.resolve(
        json({
          data: [portalWeb, repo],
          meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
        }),
      )
    }
    if (method === "POST" || method === "PATCH" || method === "DELETE") {
      const custom = overrides[method]
      if (custom) return Promise.resolve(custom())

      return Promise.resolve(
        method === "DELETE"
          ? new Response(null, { status: 204 })
          : json(portalWeb, method === "POST" ? 201 : 200),
      )
    }

    return Promise.resolve(json({ error: "Não esperado" }, 500))
  })
}

function writes(method: Method) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method)
}

function sentBody(method: Method): unknown {
  return JSON.parse(String(writes(method)[0]?.[1]?.body))
}

function listCalls(): number {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      new URL(url as string).pathname === "/projects/p1/assets" &&
      (init?.method ?? "GET") === "GET",
  ).length
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

describe("permissões na lista de ativos", () => {
  it("leitor só consulta", async () => {
    setup(person("VIEWER"))
    renderAt("/projects/p1/assets")

    await screen.findByRole("rowheader", { name: "Portal web" })

    expect(
      screen.queryByRole("button", { name: "Novo ativo" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Editar/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Excluir/ }),
    ).not.toBeInTheDocument()
  })

  it("analista cria, edita e exclui", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")

    // A lista chega depois da sessão: espera a linha antes dos outros botões.
    expect(
      await screen.findByRole("button", { name: "Editar Portal web" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Novo ativo" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Excluir Portal web" }),
    ).toBeInTheDocument()
  })

  it("admin cria, edita e exclui", async () => {
    setup(person("ADMIN", "2"))
    renderAt("/projects/p1/assets")

    expect(
      await screen.findByRole("button", {
        name: "Excluir Repositório portal-backend",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Novo ativo" }),
    ).toBeInTheDocument()
  })
})

describe("criar ativo", () => {
  it("cria, fecha o painel e recarrega a lista", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Novo ativo" }))
    const dialog = await screen.findByRole("dialog", { name: "Novo ativo" })
    await user.type(
      within(dialog).getByLabelText("Nome"),
      "  Roteador de borda ",
    )
    await user.selectOptions(within(dialog).getByLabelText("Tipo"), "NETWORK")
    await user.type(within(dialog).getByLabelText("Identificador"), "10.20.0.1")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar ativo" }),
    )

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("POST")[0]?.[0])).toBe(
      "http://api.test/projects/p1/assets",
    )
    expect(sentBody("POST")).toEqual({
      name: "Roteador de borda",
      type: "NETWORK",
      identifier: "10.20.0.1",
    })
    expect(listCalls()).toBeGreaterThan(1)
  })

  it("sem identificador, envia null e o tipo Web", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Novo ativo" }))
    const dialog = await screen.findByRole("dialog", { name: "Novo ativo" })
    await user.type(within(dialog).getByLabelText("Nome"), "Portal web 2")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar ativo" }),
    )

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(sentBody("POST")).toEqual({
      name: "Portal web 2",
      type: "WEB",
      identifier: null,
    })
  })

  it("avisa o nome curto antes de enviar", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Novo ativo" }))
    const dialog = await screen.findByRole("dialog", { name: "Novo ativo" })
    await user.type(within(dialog).getByLabelText("Nome"), "a")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar ativo" }),
    )

    expect(
      await within(dialog).findByText(
        "O nome precisa de pelo menos 2 caracteres",
      ),
    ).toBeInTheDocument()
    expect(writes("POST")).toHaveLength(0)
  })

  it("mostra o erro do servidor e mantém o painel aberto", async () => {
    setup(person("ANALYST"), {
      POST: () => json({ error: "Sem permissão para criar" }, 403),
    })
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Novo ativo" }))
    const dialog = await screen.findByRole("dialog", { name: "Novo ativo" })
    await user.type(within(dialog).getByLabelText("Nome"), "Portal web 2")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar ativo" }),
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Sem permissão para criar",
    )
    expect(dialog).toBeInTheDocument()
  })
})

describe("editar ativo", () => {
  it("abre preenchido e salva só pelo PATCH do ativo certo", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Editar Portal web" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Editar ativo" })
    const name = within(dialog).getByLabelText("Nome")
    expect(name).toHaveValue("Portal web")
    expect(within(dialog).getByLabelText("Tipo")).toHaveValue("WEB")
    expect(within(dialog).getByLabelText("Identificador")).toHaveValue(
      "https://portal.exemplo.edu.br",
    )

    await user.clear(name)
    await user.type(name, "Portal web 2")
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("PATCH")[0]?.[0])).toBe(
      "http://api.test/projects/p1/assets/a1",
    )
    expect(sentBody("PATCH")).toEqual({
      name: "Portal web 2",
      type: "WEB",
      identifier: "https://portal.exemplo.edu.br",
    })
  })

  it("ativo sem identificador abre com o campo vazio e salva null", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", {
        name: "Editar Repositório portal-backend",
      }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Editar ativo" })
    expect(within(dialog).getByLabelText("Identificador")).toHaveValue("")
    expect(within(dialog).getByLabelText("Tipo")).toHaveValue("CODE")
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("PATCH")[0]?.[0])).toBe(
      "http://api.test/projects/p1/assets/a2",
    )
    expect(sentBody("PATCH")).toEqual({
      name: "Repositório portal-backend",
      type: "CODE",
      identifier: null,
    })
  })
})

describe("excluir ativo", () => {
  it("pede confirmação, avisa dos achados e exclui o ativo certo", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Excluir Portal web" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Portal web")
    expect(dialog).toHaveTextContent("ficam sem ativo")
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("DELETE")[0]?.[0])).toBe(
      "http://api.test/projects/p1/assets/a1",
    )
  })

  it("cancelar não exclui nada", async () => {
    setup(person("ANALYST"))
    renderAt("/projects/p1/assets")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Excluir Portal web" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
    expect(writes("DELETE")).toHaveLength(0)
  })
})
