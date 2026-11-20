import type { User } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/AppError.js"
import { getSkip, toPaginated, type Paginated } from "../../utils/pagination.js"
import { isUniqueConstraintError } from "../../utils/prismaErrors.js"
import type { PublicUser } from "../auth/auth.types.js"
import { getProjectService } from "../projects/projects.service.js"
import type {
  AddMemberInput,
  ListMembersQuery,
  MemberView,
} from "./members.types.js"

type MemberUser = Pick<User, "id" | "fullname" | "email" | "role">

function toMemberView(
  user: MemberUser,
  joinedAt: Date,
  ownerId: string,
): MemberView {
  return {
    userId: user.id,
    fullname: user.fullname,
    email: user.email,
    role: user.role,
    isOwner: user.id === ownerId,
    joinedAt,
  }
}

export async function listMembersService(
  projectId: string,
  query: ListMembersQuery,
): Promise<Paginated<MemberView>> {
  const { page, pageSize } = query
  const project = await getProjectService(projectId)
  const where = { projectId }

  const [members, total] = await prisma.$transaction([
    prisma.projectMember.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullname: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.projectMember.count({ where }),
  ])

  const views = members.map((member) =>
    toMemberView(member.user, member.createdAt, project.ownerId),
  )
  return toPaginated(views, total, page, pageSize)
}

export async function addMemberService(
  actor: PublicUser,
  projectId: string,
  input: AddMemberInput,
): Promise<MemberView> {
  const project = await getProjectService(projectId)

  // Só o dono do projeto ou um ADMIN monta o time.
  if (actor.role !== "ADMIN" && project.ownerId !== actor.id) {
    throw new AppError(403, "Só o dono do projeto ou um ADMIN adiciona membros")
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) {
    throw new AppError(404, "Usuário não encontrado")
  }

  try {
    const member = await prisma.projectMember.create({
      data: { projectId, userId: user.id },
    })
    return toMemberView(user, member.createdAt, project.ownerId)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, "Usuário já é membro do projeto")
    }
    throw error
  }
}

export async function removeMemberService(
  actor: PublicUser,
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await getProjectService(projectId)

  const isSelf = actor.id === userId
  const canManage = actor.role === "ADMIN" || project.ownerId === actor.id

  // O dono ou um ADMIN remove qualquer um; cada membro pode sair sozinho.
  if (!isSelf && !canManage) {
    throw new AppError(403, "Sem permissão para remover este membro")
  }

  if (userId === project.ownerId) {
    throw new AppError(409, "O dono do projeto não pode ser removido")
  }

  // Quem sai do projeto perde o acesso, então os achados que estavam sob a
  // responsabilidade dele ficam sem responsável. Tudo ou nada.
  await prisma.$transaction([
    prisma.finding.updateMany({
      where: { projectId, assigneeId: userId },
      data: { assigneeId: null },
    }),
    prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    }),
  ])
}
