import { app } from "./app.js"
import { redis } from "./lib/redis.js"
import { env } from "./utils/getEnv.js"

await redis.connect()

app.listen(env.PORT, (error?: Error): void => {
  if (error) {
    throw error
  }

  console.log(`VulnCase API rodando em http://localhost:${env.PORT}`)
})
