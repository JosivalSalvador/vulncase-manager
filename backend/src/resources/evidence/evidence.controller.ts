import type { Request, Response } from "express"

import { uploadRoot } from "../../lib/storage.js"
import { getAuthUser } from "../../middlewares/requireAuth.js"
import type { FindingParams } from "../findings/findings.types.js"
import {
  deleteEvidenceService,
  getEvidenceFileService,
  listEvidenceService,
  uploadEvidenceService,
} from "./evidence.service.js"
import type { EvidenceParams } from "./evidence.types.js"

export async function uploadEvidence(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  const evidence = await uploadEvidenceService(
    getAuthUser(req),
    projectId,
    findingId,
    req.file,
  )
  res.status(201).json(evidence)
}

export async function listEvidence(req: Request, res: Response): Promise<void> {
  const { projectId, findingId } = req.params as FindingParams
  res.json({ data: await listEvidenceService(projectId, findingId) })
}

export async function downloadEvidence(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId, evidenceId } = req.params as EvidenceParams
  const file = await getEvidenceFileService(projectId, findingId, evidenceId)

  // Sempre como download (attachment), com o tipo vindo do CONTEÚDO validado
  // no upload. O res.download() não serve aqui porque deduziria o tipo pela
  // extensão do nome que o usuário enviou.
  res.attachment(file.originalName)
  res.type(file.mimeType)
  res.setHeader("Cache-Control", "private, no-store")
  // O frontend (porta 5173) e a API (3333) são "same-site": libera só isso.
  res.setHeader("Cross-Origin-Resource-Policy", "same-site")

  try {
    await new Promise<void>((resolve, reject) => {
      res.sendFile(file.storedName, { root: uploadRoot }, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  } catch (error) {
    // Falhou antes de enviar (ex.: arquivo sumiu do disco): a resposta de erro
    // não deve herdar os headers de download.
    if (!res.headersSent) {
      res.removeHeader("Content-Disposition")
      res.removeHeader("Cache-Control")
    }
    throw error
  }
}

export async function deleteEvidence(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId, findingId, evidenceId } = req.params as EvidenceParams
  await deleteEvidenceService(
    getAuthUser(req),
    projectId,
    findingId,
    evidenceId,
  )
  res.status(204).end()
}
