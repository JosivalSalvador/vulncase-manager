import { z } from "zod"

export const evidenceParamsSchema = z.object({
  projectId: z.uuid(),
  findingId: z.uuid(),
  evidenceId: z.uuid(),
})
