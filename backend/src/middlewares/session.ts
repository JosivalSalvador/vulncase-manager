import { RedisStore } from "connect-redis"
import type { CookieOptions, RequestHandler } from "express"
import session from "express-session"

import { redis } from "../lib/redis.js"
import { env } from "../utils/getEnv.js"

export const SESSION_COOKIE_NAME = "sid"

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
}

export const sessionMiddleware: RequestHandler = session({
  store: new RedisStore({ client: redis, prefix: "vulncase:sess:" }),
  name: SESSION_COOKIE_NAME,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { ...sessionCookieOptions, maxAge: 1000 * 60 * 60 * 8 },
})
