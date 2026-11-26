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

// O limite do cadastro é em BYTES (bcrypt): acento e emoji ocupam mais de 1.
const PASSWORD_MAX_BYTES = 72

export const registerSchema = z.object({
  fullname: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(100, "O nome tem no máximo 100 caracteres"),
  email: loginSchema.shape.email,
  password: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres")
    .refine(
      (value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES,
      "Senha longa demais: o limite é 72 bytes, e acentos e emojis ocupam mais",
    ),
})
