import { describe, expect, it } from "vitest"

import { projectSchema, toProjectBody } from "./schema"

describe("projectSchema", () => {
  it("apara os espaços e aceita descrição vazia", () => {
    expect(
      projectSchema.parse({ name: "  Portal RH  ", description: "   " }),
    ).toEqual({ name: "Portal RH", description: "" })
  })

  it("recusa nome curto, contado depois de aparar", () => {
    expect(
      projectSchema.safeParse({ name: " ab ", description: "" }).success,
    ).toBe(false)
  })

  it("recusa nome com mais de 120 e descrição com mais de 2000 caracteres", () => {
    expect(
      projectSchema.safeParse({ name: "a".repeat(121), description: "" })
        .success,
    ).toBe(false)
    expect(
      projectSchema.safeParse({ name: "Portal", description: "a".repeat(2001) })
        .success,
    ).toBe(false)
  })
})

describe("toProjectBody", () => {
  it("troca descrição vazia por null", () => {
    expect(toProjectBody({ name: "Portal RH", description: "" })).toEqual({
      name: "Portal RH",
      description: null,
    })
  })

  it("mantém a descrição preenchida", () => {
    expect(
      toProjectBody({ name: "Portal RH", description: "Intranet" }),
    ).toEqual({
      name: "Portal RH",
      description: "Intranet",
    })
  })
})
