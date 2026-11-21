import type { Project } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { removeFiles } from "../../lib/storage.js"
import { AppError } from "../../utils/AppError.js"
import { omitUndefined } from "../../utils/omitUndefined.js"
import { getSkip, toPaginated, type Paginated } from "../../utils/pagination.js"
import type { PublicUser } from "../auth/auth.types.js"
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "./projects.types.js"

export async function createProjectService(
  user: PublicUser,
  input: CreateProjectInput,
): Promise<Project> {
  // Cria o projeto e já coloca o criador como membro, tudo numa só operação.
  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId: user.id,
      members: { create: { userId: user.id } },
    },
  })
}

export async function listProjectsService(
  user: PublicUser,
  query: ListProjectsQuery,
): Promise<Paginated<Project>> {
  const { page, pageSize, search } = query

  // ADMIN vê todos; os demais só os projetos de que participam.
  const where = {
    ...(user.role === "ADMIN"
      ? {}
      : { members: { some: { userId: user.id } } }),
    ...(search ? { name: { contains: search } } : {}),
  }

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.project.count({ where }),
  ])

  return toPaginated(projects, total, page, pageSize)
}

export async function getProjectService(projectId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    throw new AppError(404, "Projeto não encontrado")
  }
  return project
}

export async function updateProjectService(
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  return prisma.project.update({
    where: { id: projectId },
    data: omitUndefined(input),
  })
}

export async function deleteProjectService(
  user: PublicUser,
  projectId: string,
): Promise<void> {
  const project = await getProjectService(projectId)

  // Apagar leva junto ativos, achados e evidências: só o dono ou um ADMIN.
  if (user.role !== "ADMIN" && project.ownerId !== user.id) {
    throw new AppError(403, "Só o dono do projeto pode excluí-lo")
  }

  // Guarda os nomes dos arquivos antes: o banco apaga tudo em cascata, e os
  // arquivos de todas as evidências do projeto precisam sair do disco.
  const evidence = await prisma.evidence.findMany({
    where: { finding: { projectId } },
    select: { storedName: true },
  })

  await prisma.project.delete({ where: { id: projectId } })
  await removeFiles(evidence.map((item) => item.storedName))
}
