import cookieParser from "cookie-parser"
import cors from "cors"
import express, { type Express } from "express"
import helmet from "helmet"
import morgan from "morgan"

import { doubleCsrfProtection } from "./middlewares/csrf.js"
import { errorHandler } from "./middlewares/errorHandler.js"
import { notFound } from "./middlewares/notFound.js"
import { sessionMiddleware } from "./middlewares/session.js"
import { routes } from "./routes/index.js"
import { env } from "./utils/getEnv.js"

export const app: Express = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: "100kb" }))
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"))
app.use(cookieParser())
app.use(sessionMiddleware)
app.use(doubleCsrfProtection)

app.use(routes)
app.use(notFound)
app.use(errorHandler)
