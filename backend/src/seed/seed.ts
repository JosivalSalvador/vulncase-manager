import bcrypt from "bcryptjs"

import type { FindingStatus } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import { removeFiles, saveFile } from "../lib/storage.js"
import { daysAgo, startOfToday } from "../utils/dates.js"
import { env } from "../utils/getEnv.js"
import {
  DEMO_PASSWORD,
  demoProjects,
  demoUsers,
  type DemoFinding,
  type DemoProject,
  type DemoUserKey,
} from "./seed.data.js"
import { finalStatus, validateDemoData } from "./seed.validate.js"

const BCRYPT_ROUNDS = 12
const DAY_MS = 24 * 60 * 60 * 1000
// Os projetos nascem mais velhos que o achado mais antigo.
const PROJECT_AGE_DAYS = 70

type UserIds = Map<DemoUserKey, string>

interface HistoryRow {
  changedById: string
  fromStatus: FindingStatus | null
  toStatus: FindingStatus
  createdAt: Date
}

// O prazo é uma data pura (meia-noite UTC), na mesma base do "vencido".
function dueDateIn(days: number): Date {
  return new Date(startOfToday().getTime() + days * DAY_MS)
}

function idOf(ids: UserIds, key: DemoUserKey): string {
  const id = ids.get(key)
  if (!id) {
    throw new Error(`Usuário de demonstração sem id: ${key}`)
  }
  return id
}

async function upsertUsers(): Promise<UserIds> {
  const password = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS)
  const ids: UserIds = new Map()

  for (const user of demoUsers) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        password,
        createdAt: daysAgo(PROJECT_AGE_DAYS + 20),
      },
      update: { fullname: user.fullname, role: user.role, password },
      select: { id: true },
    })
    ids.set(user.key, saved.id)
  }
  return ids
}

// Apaga os projetos dos usuários de demonstração (e, em cascata, ativos,
// achados, histórico e evidências), mais os arquivos das evidências no disco.
// Os usuários ficam, e os projetos de qualquer outra pessoa não são tocados.
async function resetDemoData(userIds: string[]): Promise<number> {
  const projects = await prisma.project.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  })
  const projectIds = projects.map((project) => project.id)

  const evidences = await prisma.evidence.findMany({
    where: { finding: { projectId: { in: projectIds } } },
    select: { storedName: true },
  })

  await prisma.project.deleteMany({ where: { id: { in: projectIds } } })
  await removeFiles(evidences.map((evidence) => evidence.storedName))

  return projectIds.length
}

async function createFinding(
  projectId: string,
  finding: DemoFinding,
  assetIds: Map<string, string>,
  ids: UserIds,
): Promise<void> {
  const assetId = assetIds.get(finding.asset)
  if (!assetId) {
    throw new Error(`Ativo inexistente: ${finding.asset}`)
  }

  const reporterId = idOf(ids, finding.reporter)
  const createdAt = daysAgo(finding.createdDaysAgo)
  const lastStep = finding.steps.at(-1)

  // Primeiro a criação (de nada para OPEN), depois cada mudança de status.
  const history: HistoryRow[] = [
    { changedById: reporterId, fromStatus: null, toStatus: "OPEN", createdAt },
  ]
  let previous: FindingStatus = "OPEN"
  for (const step of finding.steps) {
    history.push({
      changedById: idOf(ids, step.by),
      fromStatus: previous,
      toStatus: step.to,
      createdAt: daysAgo(step.daysAgo),
    })
    previous = step.to
  }

  const evidences = []
  for (const evidence of finding.evidence ?? []) {
    const buffer = Buffer.from(evidence.content, "utf8")
    evidences.push({
      uploadedById: reporterId,
      storedName: await saveFile(buffer, "txt"),
      originalName: evidence.fileName,
      mimeType: "text/plain",
      size: buffer.length,
      createdAt,
    })
  }

  await prisma.finding.create({
    data: {
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      status: finalStatus(finding),
      remediation: finding.remediation,
      owaspCategory: finding.owaspCategory,
      cwe: finding.cwe,
      cve: finding.cve,
      dueDate: finding.dueInDays === null ? null : dueDateIn(finding.dueInDays),
      projectId,
      assetId,
      reporterId,
      assigneeId: finding.assignee ? idOf(ids, finding.assignee) : null,
      createdAt,
      // Sem isso o Prisma carimbaria "agora", e o achado pareceria recente.
      updatedAt: daysAgo(lastStep?.daysAgo ?? finding.createdDaysAgo),
      history: { create: history },
      evidences: { create: evidences },
    },
  })
}

async function createProject(
  project: DemoProject,
  ids: UserIds,
): Promise<number> {
  const createdAt = daysAgo(PROJECT_AGE_DAYS)

  const created = await prisma.project.create({
    data: {
      name: project.name,
      description: project.description,
      ownerId: idOf(ids, project.owner),
      createdAt,
      updatedAt: createdAt,
      members: {
        create: project.members.map((key) => ({
          userId: idOf(ids, key),
          createdAt,
        })),
      },
      assets: {
        create: project.assets.map((asset) => ({
          ...asset,
          createdAt,
          updatedAt: createdAt,
        })),
      },
    },
    include: { assets: { select: { id: true, name: true } } },
  })

  const assetIds = new Map(
    created.assets.map((asset) => [asset.name, asset.id]),
  )
  for (const finding of project.findings) {
    await createFinding(created.id, finding, assetIds, ids)
  }
  return project.findings.length
}

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "O seed de demonstração não roda em produção: ele cria usuários com senha conhecida.",
    )
  }

  // Confere os dados antes de tocar no banco.
  validateDemoData(demoUsers, demoProjects)

  const ids = await upsertUsers()
  const removed = await resetDemoData([...ids.values()])

  let findings = 0
  for (const project of demoProjects) {
    findings += await createProject(project, ids)
  }

  console.log(`Projetos de demonstração anteriores removidos: ${removed}`)
  console.log(
    `Criados: ${demoUsers.length} usuários, ${demoProjects.length} projetos e ${findings} achados.`,
  )
  console.log(`Senha de todos: ${DEMO_PASSWORD}`)
  for (const user of demoUsers) {
    console.log(`  ${user.role.padEnd(8)} ${user.email}`)
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
