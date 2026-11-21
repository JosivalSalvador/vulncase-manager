import type { z } from "zod"

import type { cweQuerySchema, owaspQuerySchema } from "./catalog.schema.js"

export type OwaspQuery = z.infer<typeof owaspQuerySchema>

export type CweQuery = z.infer<typeof cweQuerySchema>
