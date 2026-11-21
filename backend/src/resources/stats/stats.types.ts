import type { z } from "zod"

import type { statsQuerySchema } from "./stats.schema.js"

export type StatsQuery = z.infer<typeof statsQuerySchema>
