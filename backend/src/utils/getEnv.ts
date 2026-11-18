import "dotenv/config"
import { bool, cleanEnv, makeValidator, port, str } from "envalid"

const secret = makeValidator((input: string): string => {
  if (input.length < 32) {
    throw new Error("precisa ter pelo menos 32 caracteres")
  }
  return input
})

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  PORT: port({ default: 3333 }),
  CORS_ORIGIN: str({ devDefault: "http://localhost:5173" }),
  DATABASE_URL: str(),
  REDIS_URL: str({ devDefault: "redis://localhost:6379" }),
  SESSION_SECRET: secret({
    devDefault: "dev-only-secret-nao-use-em-producao-0123456789",
  }),
  COOKIE_SECURE: bool({ default: true, devDefault: false }),
})
