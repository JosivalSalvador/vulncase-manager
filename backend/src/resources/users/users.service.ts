import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/AppError.js"
import { getSkip, toPaginated, type Paginated } from "../../utils/pagination.js"
import type { PublicUser } from "../auth/auth.types.js"
import type {
  ListUsersQuery,
  UpdateRoleInput,
  UserView,
} from "./users.types.js"

// Lista explícita de campos: o hash da senha nunca sai do banco por aqui.
const userSelect = {
  id: true,
  fullname: true,
  email: true,
  role: true,
  createdAt: true,
} as const

export async function listUsersService(
  query: ListUsersQuery,
): Promise<Paginated<UserView>> {
  const { page, pageSize, search, role } = query

  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { fullname: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userSelect,
      // O id desempata nomes iguais, para a paginação não repetir nem pular.
      orderBy: [{ fullname: "asc" }, { id: "asc" }],
      skip: getSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  return toPaginated(users, total, page, pageSize)
}

export async function updateUserRoleService(
  actor: PublicUser,
  userId: string,
  input: UpdateRoleInput,
): Promise<UserView> {
  // Ninguém mexe no próprio papel: assim o sistema nunca fica sem ADMIN
  // por um descuido (rebaixar a si mesmo).
  if (actor.id === userId) {
    throw new AppError(409, "Você não pode alterar o seu próprio papel")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) {
    throw new AppError(404, "Usuário não encontrado")
  }

  return prisma.user.update({
    where: { id: userId },
    data: { role: input.role },
    select: userSelect,
  })
}
