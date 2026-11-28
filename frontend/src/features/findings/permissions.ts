import type { User } from "@/features/auth/types"
import type { Project } from "@/features/projects/types"

import type { Finding } from "./types"

// Espelham o back. Aqui só decidem o que mostrar: quem decide é o servidor.
export function canWriteFindings(user: User): boolean {
  return user.role === "ADMIN" || user.role === "ANALYST"
}

// Excluir apaga o histórico e as evidências junto, então é mais restrito: quem
// registrou, o dono do projeto ou um ADMIN.
export function canDeleteFinding(
  user: User,
  project: Project,
  finding: Finding,
): boolean {
  return (
    canWriteFindings(user) &&
    (user.role === "ADMIN" ||
      project.ownerId === user.id ||
      finding.reporterId === user.id)
  )
}
