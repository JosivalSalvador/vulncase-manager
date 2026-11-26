export const ROLES = ["ADMIN", "ANALYST", "VIEWER"] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  ANALYST: "Analista",
  VIEWER: "Leitor",
}

export type User = {
  id: string
  email: string
  fullname: string
  role: Role
}
