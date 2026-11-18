import { z } from "zod"

// Normaliza (tira espaços e põe em minúsculas) ANTES de validar o formato.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

export const registerSchema = z.object({
  fullname: z.string().trim().min(2).max(100),
  email: emailSchema,
  // bcrypt só considera os primeiros 72 bytes, então limitamos em 72.
  password: z.string().min(8).max(72),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
})
