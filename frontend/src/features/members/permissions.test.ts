import { describe, expect, it } from "vitest"

import type { User } from "@/features/auth/types"
import type { Project } from "@/features/projects/types"

import { canManageMembers, canRemoveMember } from "./permissions"
import type { Member } from "./types"

const project: Project = {
  id: "p1",
  name: "Portal do Aluno",
  description: null,
  ownerId: "1",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
}

function user(role: User["role"], id: string): User {
  return { id, email: "a@a.com", fullname: "Fulano", role }
}

function member(userId: string, isOwner = false): Member {
  return {
    userId,
    fullname: "Fulano",
    email: "a@a.com",
    role: "ANALYST",
    isOwner,
    joinedAt: "2026-11-20T12:00:00.000Z",
  }
}

describe("canManageMembers", () => {
  it("só o dono do projeto e o ADMIN montam o time", () => {
    expect(canManageMembers(user("ANALYST", "1"), project)).toBe(true)
    expect(canManageMembers(user("ADMIN", "9"), project)).toBe(true)
    expect(canManageMembers(user("ANALYST", "2"), project)).toBe(false)
    expect(canManageMembers(user("VIEWER", "3"), project)).toBe(false)
  })
})

describe("canRemoveMember", () => {
  it("o dono do projeto nunca é removido, nem por ele mesmo", () => {
    const owner = member("1", true)

    expect(canRemoveMember(user("ANALYST", "1"), project, owner)).toBe(false)
    expect(canRemoveMember(user("ADMIN", "9"), project, owner)).toBe(false)
  })

  it("o dono e o ADMIN removem qualquer outro membro", () => {
    expect(canRemoveMember(user("ANALYST", "1"), project, member("2"))).toBe(
      true,
    )
    expect(canRemoveMember(user("ADMIN", "9"), project, member("2"))).toBe(true)
  })

  it("cada membro pode sair sozinho, mas não tira os outros", () => {
    expect(canRemoveMember(user("VIEWER", "3"), project, member("3"))).toBe(
      true,
    )
    expect(canRemoveMember(user("VIEWER", "3"), project, member("2"))).toBe(
      false,
    )
    expect(canRemoveMember(user("ANALYST", "2"), project, member("3"))).toBe(
      false,
    )
  })
})
