import { FolderKanban, LayoutDashboard, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { Role } from "@/features/auth/types"

export type NavItem = {
  title: string
  to: string
  icon: LucideIcon
  // Sem "roles", o item aparece para todo mundo.
  roles?: Role[]
}

export const navItems: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Projetos", to: "/projects", icon: FolderKanban },
  { title: "Usuários", to: "/admin/users", icon: Users, roles: ["ADMIN"] },
]

export function navItemsFor(role: Role): NavItem[] {
  return navItems.filter((item) => !item.roles || item.roles.includes(role))
}

export function isActivePath(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/"

  return pathname === to || pathname.startsWith(`${to}/`)
}

export function initialsOf(fullname: string): string {
  const parts = fullname.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""

  return (first + last).toUpperCase()
}
