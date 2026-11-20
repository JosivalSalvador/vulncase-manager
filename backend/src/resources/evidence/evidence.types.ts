import type { z } from "zod"

import type { evidenceParamsSchema } from "./evidence.schema.js"

export type EvidenceParams = z.infer<typeof evidenceParamsSchema>
