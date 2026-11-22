import { Router } from "express"

import { validate } from "../../middlewares/validate.js"
import { getSummary } from "./summary.controller.js"
import { summaryQuerySchema } from "./summary.schema.js"

// mergeParams: faz este router enxergar o :projectId definido no router pai.
const summaryRouter: Router = Router({ mergeParams: true })

// Só leitura: qualquer membro do projeto pode ver, inclusive o VIEWER. O acesso
// ao projeto já foi checado pelo requireProjectAccess, no router pai.
summaryRouter.get("/", validate({ query: summaryQuerySchema }), getSummary)

export default summaryRouter
