import { statsQuerySchema } from "../stats/stats.schema.js"

// O resumo usa o mesmo staleDays do dashboard e do relatório (padrão 30), então
// o "parado" do resumo segue a mesma regra.
export const summaryQuerySchema = statsQuerySchema
