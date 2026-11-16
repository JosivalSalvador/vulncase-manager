import type { NextFunction, Request, Response } from "express"

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

  // O detalhe do erro fica só no log do servidor, nunca na resposta.
  console.error(err)
  res.status(500).json({ error: "Erro interno do servidor" })
}