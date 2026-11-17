import cors from "cors"
import express, { type Express } from "express"
import helmet from "helmet"
import morgan from "morgan"

import { errorHandler } from "./middlewares/errorHandler.js"
import { notFound } from "./middlewares/notFound.js"
import { routes } from "./routes/index.js"
import { env } from "./utils/getEnv.js"

const app: Express = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN }))
app.use(express.json({ limit: "100kb" }))
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"))

app.use(routes)
app.use(notFound)
app.use(errorHandler)

app.listen(env.PORT, (error?: Error): void => {
  if (error) {
    throw error
  }

  console.log(`VulnCase API rodando em http://localhost:${env.PORT}`)
})
