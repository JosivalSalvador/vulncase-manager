import { z } from "zod"

import { paginationSchema } from "../../utils/pagination.js"

const nameSchema = z.string().trim().min(3).max(120)
const descriptionSchema = z.string().trim().max(2000)

export const projectParamsSchema = z.object({
  projectId: z.uuid(),
})

export const listProjectsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
})

export const createProjectSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.nullable().default(null),
})

export const updateProjectSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  })
