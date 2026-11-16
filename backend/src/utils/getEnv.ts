import "dotenv/config"
import { cleanEnv, port, str } from "envalid"

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  PORT: port({ default: 3333 }),
  CORS_ORIGIN: str({ devDefault: "http://localhost:5173" }),
  DATABASE_URL: str(),
})