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
type Method = "POST" | "DELETE"

const fetchMock = vi.fn<typeof fetch>()

function person(role: Role, id: string) {
  return { id, email: "a@a.com", fullname: "Fulano", role }
}

// O dono do projeto é a Ana (id 1). O Bruno (2) e a Carla (3) são membros.
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
const bruno = {
  userId: "2",
  fullname: "Bruno Tavares",
  email: "bruno@vulncase.test",
  role: "ANALYST",
  isOwner: false,
  joinedAt: "2026-11-21T12:00:00.000Z",
}
const carla = {
  userId: "3",
  fullname: "Carla Nogueira",
  email: "carla@vulncase.test",
  role: "VIEWER",
  isOwner: false,
  joinedAt: "2026-11-22T12:00:00.000Z",
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
    if (method === "GET" && pathname === "/projects/p1/members") {
      return Promise.resolve(
        json({
          data: [anaRibeiro, bruno, carla],
          meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
        }),
      )
    }
    if (method === "GET" && pathname === "/projects") {
      return Promise.resolve(
        json({
          data: [project],
          meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        }),
      )
    }
    if (method === "POST" || method === "DELETE") {
      const custom = overrides[method]
      if (custom) return Promise.resolve(custom())

      return Promise.resolve(
        method === "DELETE"
          ? new Response(null, { status: 204 })
          : json(bruno, 201),
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
      new URL(url as string).pathname === "/projects/p1/members" &&
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

describe("permissões na lista de membros", () => {
  it("o dono adiciona e remove os outros, mas não tem botão na própria linha", async () => {
    setup(person("ANALYST", "1"))
    renderAt("/projects/p1/members")

    expect(
      await screen.findByRole("button", { name: "Remover Bruno Tavares" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Remover Carla Nogueira" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Adicionar membro" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Remover Ana Ribeiro" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Sair do projeto" }),
    ).not.toBeInTheDocument()
  })

  it("o admin adiciona e remove os membros, menos o dono", async () => {
    setup(person("ADMIN", "9"))
    renderAt("/projects/p1/members")

    expect(
      await screen.findByRole("button", { name: "Remover Bruno Tavares" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Remover Carla Nogueira" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Adicionar membro" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Remover Ana Ribeiro" }),
    ).not.toBeInTheDocument()
  })

  it("analista que não é dono só pode sair, na própria linha", async () => {
    setup(person("ANALYST", "2"))
    renderAt("/projects/p1/members")

    expect(
      await screen.findByRole("button", { name: "Sair do projeto" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Adicionar membro" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Remover/ }),
    ).not.toBeInTheDocument()
  })

  it("leitor também só pode sair", async () => {
    setup(person("VIEWER", "3"))
    renderAt("/projects/p1/members")

    expect(
      await screen.findByRole("button", { name: "Sair do projeto" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Adicionar membro" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Remover/ }),
    ).not.toBeInTheDocument()
  })
})

describe("adicionar membro", () => {
  it("adiciona pelo e-mail, fecha o painel e recarrega a lista", async () => {
    setup(person("ANALYST", "1"))
    renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Adicionar membro" }),
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar membro",
    })
    await user.type(
      within(dialog).getByLabelText("E-mail"),
      "  Admin@Vulncase.Test ",
    )
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("POST")[0]?.[0])).toBe(
      "http://api.test/projects/p1/members",
    )
    expect(sentBody("POST")).toEqual({ email: "admin@vulncase.test" })
    expect(listCalls()).toBeGreaterThan(1)
  })

  it("avisa o e-mail inválido antes de enviar", async () => {
    setup(person("ANALYST", "1"))
    renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Adicionar membro" }),
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar membro",
    })
    await user.type(within(dialog).getByLabelText("E-mail"), "bruno")
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }))

    expect(
      await within(dialog).findByText("Informe um e-mail válido"),
    ).toBeInTheDocument()
    expect(writes("POST")).toHaveLength(0)
  })

  it.each([
    [404, "Usuário não encontrado"],
    [409, "Usuário já é membro do projeto"],
  ])(
    "mostra o erro %i do servidor e mantém o painel aberto",
    async (status, message) => {
      setup(person("ANALYST", "1"), {
        POST: () => json({ error: message }, status),
      })
      renderAt("/projects/p1/members")
      const user = userEvent.setup()

      await user.click(
        await screen.findByRole("button", { name: "Adicionar membro" }),
      )
      const dialog = await screen.findByRole("dialog", {
        name: "Adicionar membro",
      })
      await user.type(
        within(dialog).getByLabelText("E-mail"),
        "alguem@vulncase.test",
      )
      await user.click(
        within(dialog).getByRole("button", { name: "Adicionar" }),
      )

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        message,
      )
      expect(dialog).toBeInTheDocument()
    },
  )
})

describe("remover membro", () => {
  it("pede confirmação, avisa dos achados e remove o membro certo", async () => {
    setup(person("ANALYST", "1"))
    renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Remover Bruno Tavares" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Bruno Tavares")
    expect(dialog).toHaveTextContent("ficam sem responsável")
    const before = listCalls()
    await user.click(within(dialog).getByRole("button", { name: "Remover" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
    expect(String(writes("DELETE")[0]?.[0])).toBe(
      "http://api.test/projects/p1/members/2",
    )
    expect(listCalls()).toBeGreaterThan(before)
  })

  it("cancelar não remove ninguém", async () => {
    setup(person("ANALYST", "1"))
    renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Remover Bruno Tavares" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
    expect(writes("DELETE")).toHaveLength(0)
  })

  it("mostra o erro do servidor e mantém o diálogo aberto", async () => {
    setup(person("ANALYST", "1"), {
      DELETE: () =>
        json({ error: "Sem permissão para remover este membro" }, 403),
    })
    renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Remover Bruno Tavares" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Remover" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Sem permissão para remover este membro",
    )
    expect(dialog).toBeInTheDocument()
  })
})

describe("sair do projeto", () => {
  it("o membro sai, perde o acesso e volta para a lista de projetos", async () => {
    setup(person("VIEWER", "3"))
    const router = renderAt("/projects/p1/members")
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Sair do projeto" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Sair do projeto?")
    expect(dialog).toHaveTextContent("perde o acesso")
    expect(dialog).toHaveTextContent("Para voltar")
    const before = listCalls()
    await user.click(
      within(dialog).getByRole("button", { name: "Sair do projeto" }),
    )

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/projects"),
    )
    expect(String(writes("DELETE")[0]?.[0])).toBe(
      "http://api.test/projects/p1/members/3",
    )
    // Sem acesso, buscar os membros de novo só daria erro.
    expect(listCalls()).toBe(before)
  })
})
