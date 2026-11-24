import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import App from "./App"
import { ThemeProvider } from "@/components/theme-provider"

describe("App", () => {
  it("mostra o título do sistema", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <App />
      </ThemeProvider>,
    )

    expect(
      screen.getByRole("heading", { name: "VulnCase" }),
    ).toBeInTheDocument()
  })
})
