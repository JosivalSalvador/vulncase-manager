import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { useTheme } from "@/hooks/use-theme"

function TrocarParaEscuro() {
  const { theme, setTheme } = useTheme()

  return <button onClick={() => setTheme("dark")}>tema atual: {theme}</button>
}

afterEach(() => {
  window.localStorage.clear()
  window.document.documentElement.className = ""
  vi.unstubAllGlobals()
})

describe("ThemeProvider", () => {
  it("aplica o tema padrão na raiz do documento", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <p>conteúdo</p>
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveClass("dark")
  })

  it("usa o tema salvo no navegador no lugar do padrão", () => {
    window.localStorage.setItem("vulncase-theme", "dark")

    render(
      <ThemeProvider defaultTheme="light" storageKey="vulncase-theme">
        <p>conteúdo</p>
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveClass("dark")
    expect(document.documentElement).not.toHaveClass("light")
  })

  it("ignora um valor inválido salvo no navegador", () => {
    window.localStorage.setItem("vulncase-theme", "hacker")

    render(
      <ThemeProvider defaultTheme="light" storageKey="vulncase-theme">
        <p>conteúdo</p>
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveClass("light")
    expect(document.documentElement).not.toHaveClass("hacker")
  })

  it("troca o tema e guarda a escolha", async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider defaultTheme="light" storageKey="vulncase-theme">
        <TrocarParaEscuro />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole("button"))

    expect(document.documentElement).toHaveClass("dark")
    expect(window.localStorage.getItem("vulncase-theme")).toBe("dark")
  })

  it("no modo sistema segue a preferência do sistema operacional", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }))

    render(
      <ThemeProvider defaultTheme="system">
        <p>conteúdo</p>
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveClass("dark")
  })
})
