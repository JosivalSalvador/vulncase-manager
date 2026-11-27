import type { Role } from "@/features/auth/types"

// Resposta do back para um membro do projeto.
export type Member = {
  userId: string
  fullname: string
  email: string
  role: Role
  // O dono do projeto monta o time e não pode ser removido.
  isOwner: boolean
  // Dia em que entrou no projeto.
  joinedAt: string
}

// Corpo do POST: o back procura o usuário pelo e-mail.
export type AddMemberBody = { email: string }
