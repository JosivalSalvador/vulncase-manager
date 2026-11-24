import { useContext } from "react"

import { ThemeProviderContext } from "@/lib/theme-context"

export function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (!context) {
    throw new Error("useTheme deve ser usado dentro de um ThemeProvider")
  }

  return context
}
