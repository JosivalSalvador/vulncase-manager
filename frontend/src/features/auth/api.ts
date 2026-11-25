import { api, resetCsrfToken } from "@/lib/api"
import { ApiError } from "@/lib/api-error"

import type { User } from "./types"

export type LoginInput = { email: string; password: string }
export type RegisterInput = LoginInput & { fullname: string }

// Sem sessão o back responde 401. Aqui isso significa "ninguém logado" (null),
// e não um erro. Qualquer outra falha continua sendo erro.
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await api<User>("/auth/me")
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function login(input: LoginInput): Promise<User> {
  const user = await api<User>("/auth/login", { method: "POST", body: input })

  // O login troca a sessão, e o token CSRF é amarrado a ela.
  resetCsrfToken()

  return user
}

export function register(input: RegisterInput): Promise<User> {
  return api<User>("/auth/register", { method: "POST", body: input })
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" })
  } finally {
    resetCsrfToken()
  }
}
