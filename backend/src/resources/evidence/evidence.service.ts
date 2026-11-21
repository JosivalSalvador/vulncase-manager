import path from "node:path"

import { prisma } from "../../lib/prisma.js"
import { removeFiles, saveFile } from "../../lib/storage.js"
import { AppError } from "../../utils/AppError.js"
import type { PublicUser } from "../auth/auth.types.js"
import { getFindingService } from "../findings/findings.service.js"
import { getProjectService } from "../projects/projects.service.js"
import { detectAllowedFileType } from "./evidence.detect.js"

const MAX_EVIDENCE_PER_FINDING = 10

// Só estes campos saem para o cliente: o nome gravado no disco fica interno.
const evidenceSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullname: true } },
} as const

// O multer lê o nome do arquivo como latin1; reconvertemos para UTF-8 para os
// acentos voltarem ao normal. Depois tiramos pastas, aspas e caracteres de
// controle, que não têm lugar num nome de arquivo.
function normalizeFileName(rawName: string): string {
  const decoded = Buffer.from(rawName, "latin1").toString("utf8")
  const baseName = path.basename(decoded.replaceAll("\\", "/"))
  const cleaned = Array.from(baseName)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code >= 32 && code !== 127 && char !== '"'
    })
    .join("")
    .trim()
  return (cleaned || "evidencia").slice(0, 255)
}

export async function uploadEvidenceService(
  user: PublicUser,
  projectId: string,
  findingId: string,
  file: Express.Multer.File | undefined,
) {
  // Confirma que o achado é deste projeto antes de qualquer outra coisa.
  await getFindingService(projectId, findingId)

  if (!file || file.size === 0) {
    throw new AppError(400, 'Envie um arquivo não vazio no campo "file"')
  }

  const count = await prisma.evidence.count({ where: { findingId } })
  if (count >= MAX_EVIDENCE_PER_FINDING) {
    throw new AppError(
      409,
      `Limite de ${MAX_EVIDENCE_PER_FINDING} evidências por achado atingido`,
    )
  }

  const detected = await detectAllowedFileType(file.buffer)
  if (!detected) {
    throw new AppError(
      415,
      "Tipo de arquivo não permitido. Use PNG, JPG, WEBP, GIF, PDF ou texto puro",
    )
  }

  const storedName = await saveFile(file.buffer, detected.extension)

  try {
    return await prisma.evidence.create({
      data: {
        findingId,
        uploadedById: user.id,
        storedName,
        originalName: normalizeFileName(file.originalname),
        mimeType: detected.mimeType,
        size: file.size,
      },
      select: evidenceSelect,
    })
  } catch (error) {
    // Se o banco falhar, não deixa um arquivo órfão no disco.
    await removeFiles([storedName])
    throw error
  }
}

export async function listEvidenceService(
  projectId: string,
  findingId: string,
) {
  await getFindingService(projectId, findingId)

  return prisma.evidence.findMany({
    where: { findingId },
    select: evidenceSelect,
    orderBy: { createdAt: "asc" },
  })
}

export async function getEvidenceFileService(
  projectId: string,
  findingId: string,
  evidenceId: string,
) {
  // O achado precisa ser do projeto E a evidência precisa ser do achado.
  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, findingId, finding: { projectId } },
    select: { storedName: true, originalName: true, mimeType: true },
  })
  if (!evidence) {
    throw new AppError(404, "Evidência não encontrada")
  }
  return evidence
}

export async function deleteEvidenceService(
  user: PublicUser,
  projectId: string,
  findingId: string,
  evidenceId: string,
): Promise<void> {
  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, findingId, finding: { projectId } },
    select: { id: true, storedName: true, uploadedById: true },
  })
  if (!evidence) {
    throw new AppError(404, "Evidência não encontrada")
  }

  const project = await getProjectService(projectId)

  // Quem enviou, o dono do projeto e o ADMIN podem excluir.
  const allowed =
    user.role === "ADMIN" ||
    project.ownerId === user.id ||
    evidence.uploadedById === user.id
  if (!allowed) {
    throw new AppError(
      403,
      "Só quem enviou a evidência, o dono do projeto ou um ADMIN pode excluí-la",
    )
  }

  // Primeiro o banco, depois o arquivo: se o arquivo falhar ao apagar, sobra
  // só um arquivo solto (que vai para o log), nunca um registro sem arquivo.
  await prisma.evidence.delete({ where: { id: evidence.id, findingId } })
  await removeFiles([evidence.storedName])
}
