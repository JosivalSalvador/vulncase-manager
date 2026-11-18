import { rateLimit } from "express-rate-limit"

import { AppError } from "../utils/AppError.js"

const MENSAGEM = "Muitas tentativas. Tente novamente mais tarde."

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next): void => {
    next(new AppError(429, MENSAGEM))
  },
})

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next): void => {
    next(new AppError(429, MENSAGEM))
  },
})
