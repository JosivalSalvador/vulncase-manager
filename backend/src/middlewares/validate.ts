import type { Request, RequestHandler } from "express"
import type { ZodType } from "zod"

interface ValidationSchemas {
  body?: ZodType
  params?: ZodType
  query?: ZodType
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next): void => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body)
    }

    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Request["params"]
    }

    if (schemas.query) {
      Object.defineProperty(req, "query", {
        value: schemas.query.parse(req.query),
        writable: true,
        enumerable: true,
        configurable: true,
      })
    }

    next()
  }
}
