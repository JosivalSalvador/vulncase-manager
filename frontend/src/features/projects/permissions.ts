import type { User } from "@/features/auth/types"

import type { Project } from "./types"

// Espelham o back (canWrite e a trava do dono). Aqui só decidem o que mostrar.
export function canWriteProjects(user: User): boolean {
  return user.role === "ADMIN" || user.role === "ANALYST"
}

export function canDeleteProject(user: User, project: Project): boolean {
  return (
    canWriteProjects(user) &&
    (user.role === "ADMIN" || project.ownerId === user.id)
  )
}
