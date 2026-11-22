import { Router } from "express"

import { requireAuth } from "../../middlewares/requireAuth.js"
import { requireRole } from "../../middlewares/requireRole.js"
import { validate } from "../../middlewares/validate.js"
import { listUsers, updateUserRole } from "./users.controller.js"
import {
  listUsersQuerySchema,
  updateRoleSchema,
  userParamsSchema,
} from "./users.schema.js"

const usersRouter: Router = Router()

// Gestão de usuários: só para ADMIN.
usersRouter.use(requireAuth, requireRole("ADMIN"))

usersRouter.get("/", validate({ query: listUsersQuerySchema }), listUsers)
usersRouter.patch(
  "/:userId/role",
  validate({ params: userParamsSchema, body: updateRoleSchema }),
  updateUserRole,
)

export default usersRouter
