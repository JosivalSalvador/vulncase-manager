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

const fetchMock = vi.fn<typeof fetch>()
const ana = { id: "1", email: "ana@a.com", fullname: "Ana", role: "ANALYST" }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// Ninguém logado; o POST /auth/login responde o que o teste pedir.
function respondLoginWith(response: () => Response) {
  fetchMock.mockImplementation((input) => {
    const { pathname } = new URL(input as string)

    if (pathname === "/csrf-token") {
      return Promise.resolve(json({ csrfToken: "token" }))
    }
    if (pathname === "/auth/login") return Promise.resolve(response())

    return Promise.resolve(json({ error: "Não autenticado" }, 401))
  })
}

function loginCall() {
  return fetchMock.mock.calls.find(([url]) =>
    (url as string).endsWith("/auth/login"),
  )
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

async function submit(email: string, password: string) {
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText("E-mail"), email)
  await user.type(screen.getByLabelText("Senha"), password)
  await user.click(screen.getByRole("button", { name: "Entrar" }))
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

describe("tela de login", () => {
  it("valida os campos antes de chamar a API", async () => {
    respondLoginWith(() => json(ana))
    renderAt("/login")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Entrar" }))

    expect(
      await screen.findByText("Informe um e-mail válido"),
    ).toBeInTheDocument()
    expect(screen.getByText("Informe a senha")).toBeInTheDocument()
    expect(screen.getByLabelText("E-mail")).toHaveFocus()
    expect(loginCall()).toBeUndefined()
  })

  it("entra e volta para a página que a pessoa tentou abrir", async () => {
    respondLoginWith(() => json(ana))
    const router = renderAt("/projects?page=2")

    await submit("  Ana@A.com ", "senhaSegura123")

    expect(
      await screen.findByRole("heading", { name: "Projetos" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/projects")
    expect(router.state.location.search).toBe("?page=2")
    expect(loginCall()?.[1]?.body).toBe(
      JSON.stringify({ email: "ana@a.com", password: "senhaSegura123" }),
    )
  })

  it("mostra o erro do servidor e continua no login", async () => {
    respondLoginWith(() => json({ error: "E-mail ou senha inválidos" }, 401))
    const router = renderAt("/login")

    await submit("ana@a.com", "errada")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha inválidos",
    )
    expect(router.state.location.pathname).toBe("/login")
  })
})
