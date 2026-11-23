import { Router } from "express"

import { validate } from "../../middlewares/validate.js"
import { downloadReport } from "./reports.controller.js"
import { reportQuerySchema } from "./reports.schema.js"

// mergeParams: faz este router enxergar o :projectId definido no router pai.
const reportsRouter: Router = Router({ mergeParams: true })

// Só leitura: qualquer membro do projeto pode exportar, inclusive o VIEWER.
// O acesso ao projeto já foi checado pelo requireProjectAccess, no router pai.
reportsRouter.get("/", validate({ query: reportQuerySchema }), downloadReport)

export default reportsRouter
