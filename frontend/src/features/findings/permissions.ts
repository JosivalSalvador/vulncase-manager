import type { User } from "@/features/auth/types"

// Espelha o back (as escritas de achado pedem ADMIN ou ANALYST). Aqui só decide
// o que mostrar: quem decide é o servidor.
export function canWriteFindings(user: User): boolean {
  return user.role === "ADMIN" || user.role === "ANALYST"
}
