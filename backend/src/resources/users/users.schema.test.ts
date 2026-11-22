import { describe, expect, it } from "vitest"

import {
  listUsersQuerySchema,
  updateRoleSchema,
  userParamsSchema,
} from "./users.schema.js"

describe("updateRoleSchema", (): void => {
  it("aceita os três papéis", (): void => {
    for (const role of ["ADMIN", "ANALYST", "VIEWER"]) {
      expect(updateRoleSchema.safeParse({ role }).success).toBe(true)
    }
  })

  it("recusa papel inexistente, em minúsculas ou ausente", (): void => {
    expect(updateRoleSchema.safeParse({ role: "SUPERUSER" }).success).toBe(
      false,
    )
    expect(updateRoleSchema.safeParse({ role: "admin" }).success).toBe(false)
    expect(updateRoleSchema.safeParse({}).success).toBe(false)
  })
})

describe("listUsersQuerySchema", (): void => {
  it("usa a paginação padrão e deixa os filtros opcionais", (): void => {
    expect(listUsersQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 })
  })

  it("normaliza a busca e valida o filtro de papel", (): void => {
    const parsed = listUsersQuerySchema.parse({
      search: "  maria  ",
      role: "VIEWER",
      page: "2",
    })

    expect(parsed).toEqual({
      page: 2,
      pageSize: 10,
      search: "maria",
      role: "VIEWER",
    })
    expect(listUsersQuerySchema.safeParse({ role: "ROOT" }).success).toBe(false)
  })
})

describe("userParamsSchema", (): void => {
  it("exige um uuid", (): void => {
    expect(
      userParamsSchema.safeParse({
        userId: "4b1e3f0a-6c1d-4d57-9a53-2f0f6f7a9c11",
      }).success,
    ).toBe(true)
    expect(userParamsSchema.safeParse({ userId: "123" }).success).toBe(false)
  })
})
