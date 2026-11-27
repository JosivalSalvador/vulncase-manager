import { describe, expect, it } from "vitest"

import { addMemberSchema } from "./schema"

describe("addMemberSchema", () => {
  it("apara os espaços e põe o e-mail em minúsculas", () => {
    expect(addMemberSchema.parse({ email: "  Bruno@Vulncase.Test " })).toEqual({
      email: "bruno@vulncase.test",
    })
  })

  it("recusa e-mail vazio", () => {
    expect(addMemberSchema.safeParse({ email: "   " }).success).toBe(false)
  })

  it("recusa texto que não é e-mail", () => {
    expect(addMemberSchema.safeParse({ email: "bruno" }).success).toBe(false)
    expect(addMemberSchema.safeParse({ email: "bruno@" }).success).toBe(false)
  })
})
