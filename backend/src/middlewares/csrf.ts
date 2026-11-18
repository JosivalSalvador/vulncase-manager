import { doubleCsrf } from "csrf-csrf"

import { env } from "../utils/getEnv.js"

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: (): string => env.CSRF_SECRET,
  getSessionIdentifier: (req): string => req.session.userId ?? "anonymous",
  cookieName: env.COOKIE_SECURE ? "__Host-vulncase.csrf" : "vulncase.csrf",
  cookieOptions: { secure: env.COOKIE_SECURE },
  errorConfig: { message: "Token CSRF inválido ou ausente" },
})
