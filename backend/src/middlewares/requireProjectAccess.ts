import type { RequestHandler } from "express"

import { prisma } from "../lib/prisma.js"
import { AppError } from "../utils/AppError.js"
import { getAuthUser } from "./requireAuth.js"

export const requireProjectAccess: RequestHandler = async (req, _res, next) => {
  const user = getAuthUser(req)
  const projectId = req.params["projectId"]

  if (typeof projectId !== "string") {
    throw new AppError(404, "Projeto não encontrado")
  }

  if (user.role === "ADMIN") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })
    if (!project) {
      throw new AppError(404, "Projeto não encontrado")
    }
    next()
    return
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  })
  if (!membership) {
    throw new AppError(404, "Projeto não encontrado")
  }

  next()
}
