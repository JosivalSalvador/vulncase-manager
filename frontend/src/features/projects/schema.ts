import { z } from "zod"

import type { ProjectBody } from "./types"

// Espelha o createProjectSchema do back, só para avisar antes de enviar.
export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "O nome precisa de pelo menos 3 caracteres")
    .max(120, "O nome tem no máximo 120 caracteres"),
  description: z
    .string()
    .trim()
    .max(2000, "A descrição tem no máximo 2000 caracteres"),
})

export type ProjectFormValues = z.infer<typeof projectSchema>

// O formulário trabalha com texto; o back guarda "sem descrição" como null.
export function toProjectBody(values: ProjectFormValues): ProjectBody {
  return {
    name: values.name,
    description: values.description === "" ? null : values.description,
  }
}
