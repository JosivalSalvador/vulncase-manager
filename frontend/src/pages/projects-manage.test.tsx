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

// O portal é da Ana (id 1); a loja é de outra pessoa.
const portal = {
  id: "p1",
  name: "Portal RH",
  description: "Intranet do RH",
  ownerId: "1",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
}
const loja = {
  ...portal,
  id: "p2",
  name: "Loja Online",
  description: null,
  ownerId: "9",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// Sessão, lista e escritas. Cada teste pode trocar a resposta de uma escrita.
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
    if (method === "GET" && pathname === "/projects") {
      return Promise.resolve(
        json({
          data: [portal, loja],
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
          : json(portal, method === "POST" ? 201 : 200),
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
      new URL(url as string).pathname === "/projects" &&
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

describe("permissões na lista de projetos", () => {
  it("leitor só consulta", async () => {
    setup(person("VIEWER"))
    renderAt("/projects")

    await screen.findByRole("link", { name: "Portal RH" })

    expect(
      screen.queryByRole("button", { name: "Novo projeto" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Editar/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Excluir/ }),
    ).not.toBeInTheDocument()
  })

  it("analista edita todos, mas exclui só os que criou", async () => {
    setup(person("ANALYST"))
    renderAt("/projects")

    expect(
      await screen.findByRole("button", { name: "Editar Portal RH" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Editar Loja Online" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Excluir Portal RH" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Excluir Loja Online" }),
    ).not.toBeInTheDocument()
  })

  it("admin exclui qualquer projeto", async () => {
    setup(person("ADMIN", "2"))
    renderAt("/projects")

    expect(
      await screen.findByRole("button", { name: "Excluir Portal RH" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Excluir Loja Online" }),
    ).toBeInTheDocument()
  })
})

describe("criar projeto", () => {
  it("cria, fecha o formulário e recarrega a lista", async () => {
    setup(person("ANALYST"))
    renderAt("/projects")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Novo projeto" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Novo projeto" })
    await user.type(within(dialog).getByLabelText("Nome"), "  Portal RH ")
    await user.type(within(dialog).getByLabelText("Descrição"), "Intranet")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar projeto" }),
    )

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(sentBody("POST")).toEqual({
      name: "Portal RH",
      description: "Intranet",
    })
    expect(listCalls()).toBeGreaterThan(1)
  })

  it("avisa o nome curto antes de enviar", async () => {
    setup(person("ANALYST"))
    renderAt("/projects")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Novo projeto" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Novo projeto" })
    await user.type(within(dialog).getByLabelText("Nome"), "ab")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar projeto" }),
    )

    expect(
      await within(dialog).findByText(
        "O nome precisa de pelo menos 3 caracteres",
      ),
    ).toBeInTheDocument()
    expect(writes("POST")).toHaveLength(0)
  })

  it("mostra o erro do servidor e mantém o formulário aberto", async () => {
    setup(person("ANALYST"), {
      POST: () => json({ error: "Sem permissão para criar" }, 403),
    })
    renderAt("/projects")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Novo projeto" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Novo projeto" })
    await user.type(within(dialog).getByLabelText("Nome"), "Portal RH")
    await user.click(
      within(dialog).getByRole("button", { name: "Criar projeto" }),
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Sem permissão para criar",
    )
    expect(dialog).toBeInTheDocument()
  })
})

describe("editar projeto", () => {
  it("abre preenchido e salva só pelo PATCH do projeto certo", async () => {
    setup(person("ANALYST"))
    renderAt("/projects")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Editar Portal RH" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Editar projeto" })
    const name = within(dialog).getByLabelText("Nome")
    expect(name).toHaveValue("Portal RH")
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue(
      "Intranet do RH",
    )

    await user.clear(name)
    await user.type(name, "Portal RH 2")
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("PATCH")[0]?.[0])).toBe("http://api.test/projects/p1")
    expect(sentBody("PATCH")).toEqual({
      name: "Portal RH 2",
      description: "Intranet do RH",
    })
  })
})

describe("excluir projeto", () => {
  it("pede confirmação e exclui o projeto certo", async () => {
    setup(person("ANALYST"))
    renderAt("/projects")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Excluir Portal RH" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Portal RH")
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("DELETE")[0]?.[0])).toBe("http://api.test/projects/p1")
  })

  it("cancelar não exclui nada", async () => {
    setup(person("ANALYST"))
    renderAt("/projects")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Excluir Portal RH" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
    expect(writes("DELETE")).toHaveLength(0)
  })
})
