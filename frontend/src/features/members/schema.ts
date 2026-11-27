import { z } from "zod"

import { loginSchema } from "@/features/auth/schema"

// Espelha o addMemberSchema do back, só para avisar antes de enviar. O e-mail é
// o mesmo do login: apara os espaços, põe em minúsculas e confere o formato.
export const addMemberSchema = z.object({
  email: loginSchema.shape.email,
})

export type AddMemberFormValues = z.infer<typeof addMemberSchema>
