import { describe, expect, it } from "vitest"

import { parseSeverity, parseStale, parseStatus } from "./filters"

describe("filtros da URL", () => {
  it("aceita os valores que a tela oferece", () => {
    expect(parseSeverity("CRITICAL")).toBe("CRITICAL")
    expect(parseStatus("FALSE_POSITIVE")).toBe("FALSE_POSITIVE")
    expect(parseStale("30")).toBe(30)
  })

  it("trata o que não existe como sem filtro", () => {
    expect(parseSeverity("XYZ")).toBeUndefined()
    expect(parseSeverity(null)).toBeUndefined()
    expect(parseStatus("abc")).toBeUndefined()
    expect(parseStatus(null)).toBeUndefined()
    expect(parseStale("5")).toBeUndefined()
    expect(parseStale("abc")).toBeUndefined()
    expect(parseStale(null)).toBeUndefined()
  })
})
