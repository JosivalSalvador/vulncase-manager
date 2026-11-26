import { useMutation, useQueryClient } from "@tanstack/react-query"

import { login, register, type RegisterInput } from "./api"

import { startSession } from "./start-session"

// O cadastro do back não abre sessão: em seguida fazemos o login.
async function registerAndLogin(input: RegisterInput) {
  await register(input)

  try {
    return await login({ email: input.email, password: input.password })
  } catch {
    // A conta já existe: tentar cadastrar de novo daria "já cadastrado".
    throw new Error(
      "Conta criada, mas não foi possível entrar. Use a tela de login.",
    )
  }
}

export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: registerAndLogin,
    onSuccess: (user) => startSession(queryClient, user),
  })
}
