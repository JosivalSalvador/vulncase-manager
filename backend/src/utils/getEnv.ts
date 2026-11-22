import "dotenv/config"
import { bool, cleanEnv, makeValidator, port, str } from "envalid"

const secret = makeValidator((input: string): string => {
  if (input.length < 32) {
    throw new Error("precisa ter pelo menos 32 caracteres")
  }
  return input
})

// Nome IANA de fuso horário, como "America/Manaus". O próprio Intl recusa
// nomes que não existem.
const timeZone = makeValidator((input: string): string => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: input })
  } catch {
    throw new Error("precisa ser um fuso IANA válido, como America/Manaus")
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
  CSRF_SECRET: secret({
    devDefault: "dev-only-csrf-nao-use-em-producao-abcdefghijk",
  }),
  UPLOAD_DIR: str({ default: "uploads" }),
  APP_TIMEZONE: timeZone({ default: "America/Manaus" }),
})
