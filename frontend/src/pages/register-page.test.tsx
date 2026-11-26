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

function respondRegisterWith(response: () => Response) {
  fetchMock.mockImplementation((input) => {
    const { pathname } = new URL(input as string)

    if (pathname === "/csrf-token") {
      return Promise.resolve(json({ csrfToken: "token" }))
    }
    if (pathname === "/auth/register") return Promise.resolve(response())
    if (pathname === "/auth/login") return Promise.resolve(json(ana))

    return Promise.resolve(json({ error: "Não autenticado" }, 401))
  })
}

function postedPaths() {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([url]) => new URL(url as string).pathname)
}

async function submit(password: string) {
  render(
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider
          router={createMemoryRouter(routes, {
            initialEntries: ["/register"],
          })}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText("Nome completo"), "Ana")
  await user.type(screen.getByLabelText("E-mail"), "ana@a.com")
  await user.type(screen.getByLabelText("Senha"), password)
  await user.click(screen.getByRole("button", { name: "Criar conta" }))
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

describe("tela de cadastro", () => {
  it("conta a senha em bytes, não em caracteres", async () => {
    respondRegisterWith(() => json(ana, 201))

    // 37 caracteres, mas 74 bytes.
    await submit("ç".repeat(37))

    expect(await screen.findByText(/limite é 72 bytes/)).toBeInTheDocument()
    expect(postedPaths()).toEqual([])
  })

  it("cria a conta e já entra", async () => {
    respondRegisterWith(() => json(ana, 201))

    await submit("senhaSegura123")

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument()
    expect(postedPaths()).toEqual(["/auth/register", "/auth/login"])
  })

  it("mostra o erro de e-mail já cadastrado", async () => {
    respondRegisterWith(() => json({ error: "E-mail já cadastrado" }, 409))

    await submit("senhaSegura123")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail já cadastrado",
    )
    expect(postedPaths()).toEqual(["/auth/register"])
  })
})
