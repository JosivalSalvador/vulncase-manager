import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { ModeToggle } from "@/components/mode-toggle"
import { ThemeProvider } from "@/components/theme-provider"

afterEach(() => {
  window.localStorage.clear()
  window.document.documentElement.className = ""
})

describe("ModeToggle", () => {
  it("troca para o tema escuro pelo menu", async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider defaultTheme="light">
        <ModeToggle />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Alternar tema" }))
    await user.click(await screen.findByRole("menuitem", { name: "Escuro" }))

    expect(document.documentElement).toHaveClass("dark")
  })
})
