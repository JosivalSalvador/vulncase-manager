import type { User } from "@/features/auth/types"
import type { Project } from "@/features/projects/types"

import type { Member } from "./types"

// Espelham o back (members.service). Aqui só decidem o que mostrar: quem decide
// é o servidor.

// Só o dono do projeto ou um ADMIN monta o time (adiciona e tira os outros).
export function canManageMembers(user: User, project: Project): boolean {
  return user.role === "ADMIN" || project.ownerId === user.id
}

// O dono nunca é removido. Os outros saem pelas mãos de quem monta o time ou
// sozinhos (cada membro pode sair do projeto).
export function canRemoveMember(
  user: User,
  project: Project,
  member: Member,
): boolean {
  if (member.isOwner) return false

  return canManageMembers(user, project) || member.userId === user.id
}
