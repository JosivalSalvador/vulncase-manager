import { Router } from "express"

import { requireAuth } from "../../middlewares/requireAuth.js"
import { validate } from "../../middlewares/validate.js"
import { getCwe, getOwasp } from "./catalog.controller.js"
import { cweQuerySchema, owaspQuerySchema } from "./catalog.schema.js"

const catalogRouter: Router = Router()

// Dados de referência (somente leitura), mas ainda assim só para quem logou.
catalogRouter.use(requireAuth)

catalogRouter.get("/owasp", validate({ query: owaspQuerySchema }), getOwasp)
catalogRouter.get("/cwe", validate({ query: cweQuerySchema }), getCwe)

export default catalogRouter
