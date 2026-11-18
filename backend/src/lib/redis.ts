import { createClient } from "redis"

import { env } from "../utils/getEnv.js"

export const redis = createClient({ url: env.REDIS_URL })

redis.on("error", (error: unknown): void => {
  console.error("Erro no Redis:", error)
})
