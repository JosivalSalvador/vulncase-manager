import { describe, expect, it } from "vitest"

import { loginSchema, registerSchema } from "./auth.schema.js"

function register(password: string) {
  return registerSchema.safeParse({
    fullname: "Maria Silva",
    email: "maria@exemplo.com",
    password,
  })
}

describe("registerSchema: tamanho da senha", (): void => {
  it("aceita de 8 a 72 caracteres ASCII e recusa 73", (): void => {
    expect(register("a".repeat(8)).success).toBe(true)
    expect(register("a".repeat(72)).success).toBe(true)
    expect(register("a".repeat(73)).success).toBe(false)
  })

  it("recusa menos de 8 caracteres, mesmo que tenha mais de 8 bytes", (): void => {
    expect(register("1234567").success).toBe(false)
    // 7 caracteres, 14 bytes.
    expect(register("ç".repeat(7)).success).toBe(false)
    expect(register("ç".repeat(8)).success).toBe(true)
  })

  it("conta bytes, não caracteres: acento ocupa 2 bytes", (): void => {
    // 36 x 2 = 72 bytes (cabe); 37 x 2 = 74 bytes, com só 37 caracteres.
    expect(register("ç".repeat(36)).success).toBe(true)
    expect(register("ç".repeat(37)).success).toBe(false)
  })

  it("conta bytes, não caracteres: emoji ocupa 4 bytes", (): void => {
    // 18 x 4 = 72 bytes (cabe); 19 x 4 = 76 bytes.
    expect(register("🔒".repeat(18)).success).toBe(true)
    expect(register("🔒".repeat(19)).success).toBe(false)
  })

  it("aponta o campo e explica o limite em bytes", (): void => {
    const result = register("ç".repeat(37))

    expect(result.success).toBe(false)
    if (result.success) return

    const issue = result.error.issues[0]
    expect(issue?.path).toEqual(["password"])
    expect(issue?.message).toContain("72 bytes")
  })
})

describe("loginSchema: tamanho da senha", (): void => {
  it("continua aceitando até 72 caracteres, mesmo com mais de 72 bytes", (): void => {
    const login = (password: string) =>
      loginSchema.safeParse({ email: "maria@exemplo.com", password })

    expect(login("a".repeat(72)).success).toBe(true)
    // 40 caracteres, 80 bytes: conta antiga ainda consegue entrar.
    expect(login("ç".repeat(40)).success).toBe(true)
    expect(login("a".repeat(73)).success).toBe(false)
    expect(login("").success).toBe(false)
  })
})
