import type { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"

import { AppError, type ErrorDetail } from "../utils/AppError.js"

function getErrorType(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "type" in err) {
    return typeof err.type === "string" ? err.type : undefined
  }
  return undefined
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    })
    return
  }

  if (err instanceof ZodError) {
    const details: ErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))
    res.status(400).json({ error: "Dados inválidos", details })
    return
  }

  const type = getErrorType(err)
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido" })
    return
  }
  if (type === "entity.too.large") {
    res.status(413).json({ error: "Corpo da requisição grande demais" })
    return
  }

  console.error(err)
  res.status(500).json({ error: "Erro interno do servidor" })
}
