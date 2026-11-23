import { z } from "zod"

import { statsQuerySchema } from "../stats/stats.schema.js"

// Herda o staleDays do dashboard: o "parado" do relatório segue a mesma regra.
export const reportQuerySchema = statsQuerySchema.extend({
  format: z.enum(["csv", "md"]).default("md"),
})
