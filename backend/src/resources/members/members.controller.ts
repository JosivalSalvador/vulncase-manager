import type { Request, Response } from "express"

import { getAuthUser } from "../../middlewares/requireAuth.js"
import {
  addMemberService,
  listMembersService,
  removeMemberService,
} from "./members.service.js"
import type {
  AddMemberInput,
  ListMembersQuery,
  MemberParams,
} from "./members.types.js"

type ProjectParams = Pick<MemberParams, "projectId">

export async function listMembers(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const result = await listMembersService(
    projectId,
    req.query as unknown as ListMembersQuery,
  )
  res.json(result)
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const member = await addMemberService(
    getAuthUser(req),
    projectId,
    req.body as AddMemberInput,
  )
  res.status(201).json(member)
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const { projectId, userId } = req.params as MemberParams
  await removeMemberService(getAuthUser(req), projectId, userId)
  res.status(204).end()
}
