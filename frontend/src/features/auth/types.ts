export const ROLES = ["ADMIN", "ANALYST", "VIEWER"] as const

export type Role = (typeof ROLES)[number]

export type User = {
  id: string
  email: string
  fullname: string
  role: Role
}
