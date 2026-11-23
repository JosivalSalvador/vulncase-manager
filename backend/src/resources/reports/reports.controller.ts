import type { Request, Response } from "express"

import type { FindingParams } from "../findings/findings.types.js"
import { buildReportService } from "./reports.service.js"
import type { ReportQuery } from "./reports.types.js"

type ProjectParams = Pick<FindingParams, "projectId">

export async function downloadReport(
  req: Request,
  res: Response,
): Promise<void> {
  const { projectId } = req.params as ProjectParams
  const report = await buildReportService(
    projectId,
    req.query as unknown as ReportQuery,
  )

  // Sempre como download (attachment). O attachment() já deduz o tipo pela
  // extensão, então o Content-Type é definido DEPOIS, com o charset explícito.
  res.attachment(report.filename)
  res.setHeader("Content-Type", report.contentType)
  // O relatório tem dados do projeto: nada de cache em proxy ou disco.
  res.setHeader("Cache-Control", "private, no-store")
  res.send(report.body)
}
