import { prisma } from "../../lib/prisma.js"
import { AppError, type ErrorDetail } from "../../utils/AppError.js"
import { omitUndefined } from "../../utils/omitUndefined.js"
import { getSkip, toPaginated } from "../../utils/pagination.js"
import type { PublicUser } from "../auth/auth.types.js"
import { assertTransitionAllowed } from "./findings.transitions.js"
import { getProjectService } from "../projects/projects.service.js"
import type {
  ChangeStatusInput,
  CreateFindingInput,
  ListFindingsQuery,
  ListHistoryQuery,
  UpdateFindingInput,
} from "./findings.types.js"

// Dados das relações que o frontend mostra junto do achado.
const findingInclude = {
  asset: { select: { id: true, name: true, type: true } },
  assignee: { select: { id: true, fullname: true } },
  reporter: { select: { id: true, fullname: true } },
} as const

// Quem fez a mudança de status, para mostrar no histórico.
const historyInclude = {
  changedBy: { select: { id: true, fullname: true } },
} as const

// O ativo e o responsável precisam pertencer ao MESMO projeto do achado.
// Sem essa checagem, dava para ligar um achado a um ativo de outro projeto.
export async function assertRelationsBelongToProject(
  projectId: string,
  assetId: string | null | undefined,
  assigneeId: string | null | undefined,
): Promise<void> {
  const details: ErrorDetail[] = []

  if (assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId, projectId },
      select: { id: true },
    })
    if (!asset) {
      details.push({
        field: "assetId",
        message: "Ativo não encontrado neste projeto",
      })
    }
  }

  if (assigneeId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
    })
    if (!member) {
      details.push({
        field: "assigneeId",
        message: "O responsável precisa ser membro do projeto",
      })
    }
  }

  if (details.length > 0) {
    throw new AppError(400, "Dados inválidos", details)
  }
}

export async function createFindingService(
  user: PublicUser,
  projectId: string,
  input: CreateFindingInput,
) {
  await assertRelationsBelongToProject(
    projectId,
    input.assetId,
    input.assigneeId,
  )

  return prisma.finding.create({
    data: {
      title: input.title,
      description: input.description,
      severity: input.severity,
      remediation: input.remediation,
      owaspCategory: input.owaspCategory,
      cwe: input.cwe,
      cve: input.cve,
      dueDate: input.dueDate,
      projectId,
      assetId: input.assetId,
      assigneeId: input.assigneeId,
      reporterId: user.id,
      // O status nasce OPEN (padrão do banco) e o histórico já registra isso.
      history: {
        create: { changedById: user.id, fromStatus: null, toStatus: "OPEN" },
      },
    },
    include: findingInclude,
  })
}

export async function listFindingsService(
  projectId: string,
  query: ListFindingsQuery,
) {
  const { page, pageSize, severity, status, assigneeId, assetId, search } =
    query

  const where = {
    projectId,
    ...(severity ? { severity } : {}),
    ...(status ? { status } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(assetId ? { assetId } : {}),
    ...(search ? { title: { contains: search } } : {}),
  }

  const [findings, total] = await prisma.$transaction([
    prisma.finding.findMany({
      where,
      include: findingInclude,
      // O enum Severity está declarado do mais grave ao menos grave, então
      // "asc" traz os CRITICAL primeiro. Dentro da mesma severidade, os novos.
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      skip: getSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.finding.count({ where }),
  ])

  return toPaginated(findings, total, page, pageSize)
}

export async function getFindingService(projectId: string, findingId: string) {
  const finding = await prisma.finding.findUnique({
    where: { id: findingId, projectId },
    include: findingInclude,
  })
  if (!finding) {
    throw new AppError(404, "Achado não encontrado")
  }
  return finding
}

export async function updateFindingService(
  projectId: string,
  findingId: string,
  input: UpdateFindingInput,
) {
  await assertRelationsBelongToProject(
    projectId,
    input.assetId,
    input.assigneeId,
  )

  // Se o achado não existir nesse projeto, o Prisma lança P2025 (vira 404).
  return prisma.finding.update({
    where: { id: findingId, projectId },
    data: omitUndefined(input),
    include: findingInclude,
  })
}

export async function deleteFindingService(
  user: PublicUser,
  projectId: string,
  findingId: string,
): Promise<void> {
  const finding = await getFindingService(projectId, findingId)
  const project = await getProjectService(projectId)

  // Excluir apaga também o histórico e as evidências do achado, então fica
  // restrito a quem registrou, ao dono do projeto e ao ADMIN.
  const allowed =
    user.role === "ADMIN" ||
    project.ownerId === user.id ||
    finding.reporterId === user.id
  if (!allowed) {
    throw new AppError(
      403,
      "Só quem registrou o achado, o dono do projeto ou um ADMIN pode excluí-lo",
    )
  }

  await prisma.finding.delete({ where: { id: findingId, projectId } })
}

export async function changeFindingStatusService(
  user: PublicUser,
  projectId: string,
  findingId: string,
  input: ChangeStatusInput,
) {
  const finding = await getFindingService(projectId, findingId)
  const from = finding.status
  const to = input.status

  assertTransitionAllowed(from, to)

  // Muda o status e grava o histórico juntos: ou os dois acontecem, ou nenhum.
  await prisma.$transaction(async (tx) => {
    // O "status: from" no where evita corrida: se outra pessoa mudou o status
    // depois da nossa leitura, nenhuma linha é atualizada e abortamos.
    const updated = await tx.finding.updateMany({
      where: { id: findingId, projectId, status: from },
      data: { status: to },
    })
    if (updated.count === 0) {
      throw new AppError(
        409,
        "O status do achado mudou enquanto você editava. Atualize e tente de novo",
      )
    }

    await tx.statusHistory.create({
      data: {
        findingId,
        changedById: user.id,
        fromStatus: from,
        toStatus: to,
      },
    })
  })

  return getFindingService(projectId, findingId)
}

export async function listFindingHistoryService(
  projectId: string,
  findingId: string,
  query: ListHistoryQuery,
) {
  const { page, pageSize } = query

  // Garante que o achado é DESTE projeto antes de mostrar o histórico dele.
  await getFindingService(projectId, findingId)

  const where = { findingId }

  const [history, total] = await prisma.$transaction([
    prisma.statusHistory.findMany({
      where,
      include: historyInclude,
      orderBy: { createdAt: "asc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.statusHistory.count({ where }),
  ])

  return toPaginated(history, total, page, pageSize)
}
