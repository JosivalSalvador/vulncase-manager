import { describe, expect, it } from "vitest"

import { ASSET_TYPES } from "./labels"
import { assetSchema, toAssetBody } from "./schema"

describe("assetSchema", () => {
  it("apara os espaços e aceita identificador vazio", () => {
    expect(
      assetSchema.parse({
        name: "  Portal web  ",
        type: "WEB",
        identifier: "   ",
      }),
    ).toEqual({ name: "Portal web", type: "WEB", identifier: "" })
  })

  it("recusa nome curto, contado depois de aparar", () => {
    expect(
      assetSchema.safeParse({ name: " a ", type: "WEB", identifier: "" })
        .success,
    ).toBe(false)
  })

  it("recusa nome com mais de 120 e identificador com mais de 255 caracteres", () => {
    expect(
      assetSchema.safeParse({
        name: "a".repeat(121),
        type: "WEB",
        identifier: "",
      }).success,
    ).toBe(false)
    expect(
      assetSchema.safeParse({
        name: "Portal web",
        type: "WEB",
        identifier: "a".repeat(256),
      }).success,
    ).toBe(false)
  })

  it("recusa tipo que não existe", () => {
    expect(
      assetSchema.safeParse({ name: "Portal web", type: "XYZ", identifier: "" })
        .success,
    ).toBe(false)
  })

  it("aceita todos os tipos que a tela oferece", () => {
    for (const { value } of ASSET_TYPES) {
      expect(
        assetSchema.safeParse({
          name: "Portal web",
          type: value,
          identifier: "",
        }).success,
      ).toBe(true)
    }
  })
})

describe("toAssetBody", () => {
  it("troca identificador vazio por null", () => {
    expect(
      toAssetBody({ name: "Portal web", type: "WEB", identifier: "" }),
    ).toEqual({ name: "Portal web", type: "WEB", identifier: null })
  })

  it("mantém o identificador preenchido", () => {
    expect(
      toAssetBody({
        name: "Roteador",
        type: "NETWORK",
        identifier: "10.20.0.1",
      }),
    ).toEqual({ name: "Roteador", type: "NETWORK", identifier: "10.20.0.1" })
  })
})
