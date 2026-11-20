import { Router } from "express"

import { validate } from "../../middlewares/validate.js"
import { addMember, listMembers, removeMember } from "./members.controller.js"
import {
  addMemberSchema,
  listMembersQuerySchema,
  memberParamsSchema,
} from "./members.schema.js"

// mergeParams: faz este router enxergar o :projectId definido no router pai.
const membersRouter: Router = Router({ mergeParams: true })

membersRouter.get("/", validate({ query: listMembersQuerySchema }), listMembers)
membersRouter.post("/", validate({ body: addMemberSchema }), addMember)
membersRouter.delete(
  "/:userId",
  validate({ params: memberParamsSchema }),
  removeMember,
)

export default membersRouter
