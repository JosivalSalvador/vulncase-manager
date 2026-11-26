import { z } from "zod"

// Espelha o loginSchema do back. Aqui é só para avisar antes de enviar: quem
// decide continua sendo o servidor.
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Informe um e-mail válido" })),
  password: z
    .string()
    .min(1, "Informe a senha")
    .max(72, "A senha tem no máximo 72 caracteres"),
})
