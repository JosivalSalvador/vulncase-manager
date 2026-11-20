import type { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"

import { AppError, type ErrorDetail } from "../utils/AppError.js"

function getStringProp(err: unknown, key: string): string | undefined {
  if (typeof err === "object" && err !== null && key in err) {
    const value = (err as Record<string, unknown>)[key]
    return typeof value === "string" ? value : undefined
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

  // Erro nosso, lançado de propósito (ex.: 401, 403, 404, 409).
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    })
    return
  }

  // Erro de validação do zod: devolve campo + mensagem, sem o valor enviado.
  if (err instanceof ZodError) {
    const details: ErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))
    res.status(400).json({ error: "Dados inválidos", details })
    return
  }

  // Token CSRF ausente ou inválido (vem do csrf-csrf).
  if (getStringProp(err, "code") === "EBADCSRFTOKEN") {
    res.status(403).json({ error: "Token CSRF inválido ou ausente" })
    return
  }

  // Erros do multer (upload): tamanho, quantidade de arquivos, campo errado.
  if (getStringProp(err, "name") === "MulterError") {
    if (getStringProp(err, "code") === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Arquivo grande demais (limite: 5 MB)" })
      return
    }
    res.status(400).json({
      error: 'Upload inválido: envie um único arquivo no campo "file"',
    })
    return
  }

  // O registro existe, mas o arquivo sumiu do disco.
  if (getStringProp(err, "code") === "ENOENT") {
    res.status(404).json({ error: "Arquivo não encontrado" })
    return
  }

  // Prisma: registro não encontrado (ex.: apagado por outra requisição).
  if (getStringProp(err, "code") === "P2025") {
    res.status(404).json({ error: "Registro não encontrado" })
    return
  }

  // Erros do parser de JSON do Express (antes davam 500).
  const type = getStringProp(err, "type")
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido" })
    return
  }
  if (type === "entity.too.large") {
    res.status(413).json({ error: "Corpo da requisição grande demais" })
    return
  }

  // O detalhe do erro fica só no log do servidor, nunca na resposta.
  console.error(err)
  res.status(500).json({ error: "Erro interno do servidor" })
}
