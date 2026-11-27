import type { User } from "@/features/auth/types"

// Espelha o back (as escritas de ativo pedem ADMIN ou ANALYST). Aqui só decide
// o que mostrar: quem decide é o servidor.
export function canWriteAssets(user: User): boolean {
  return user.role === "ADMIN" || user.role === "ANALYST"
}
