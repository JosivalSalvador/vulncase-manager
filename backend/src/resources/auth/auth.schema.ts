import { z } from "zod"

// O bcrypt só usa os primeiros 72 BYTES da senha, não 72 caracteres: acentos
// e emojis ocupam mais de 1 byte. Acima disso o resto seria ignorado em
// silêncio, então o cadastro recusa em vez de truncar.
export const PASSWORD_MAX_BYTES = 72

// Normaliza (tira espaços e põe em minúsculas) ANTES de validar o formato.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

const newPasswordSchema = z
  .string()
  .min(8)
  .refine((value) => Buffer.byteLength(value, "utf8") <= PASSWORD_MAX_BYTES, {
    message: `A senha pode ter no máximo ${PASSWORD_MAX_BYTES} bytes (acentos e emojis ocupam mais de 1)`,
  })

export const registerSchema = z.object({
  fullname: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: newPasswordSchema,
})

// No login o limite continua em 72 caracteres, de propósito: toda senha aceita
// no cadastro cabe nele, e quem já tem conta com uma senha mais longa em bytes
// (cadastrada antes desta regra) continua conseguindo entrar.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
})
