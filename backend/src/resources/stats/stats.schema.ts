import { z } from "zod"

// "Parado": achado ainda aberto há mais de N dias. Padrão: 30.
export const statsQuerySchema = z.object({
  staleDays: z.coerce.number().int().min(1).max(365).default(30),
})
