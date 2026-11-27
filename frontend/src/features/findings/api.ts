import { api } from "@/lib/api"
import type { Paginated } from "@/lib/pagination"

import type { FindingStatus, Severity } from "./labels"
import type { Finding } from "./types"

export type ListFindingsParams = {
  page?: number
  pageSize?: number
  severity?: Severity
  status?: FindingStatus
  assigneeId?: string
  assetId?: string
  // Busca no título.
  search?: string
  // true: só os abertos com o prazo vencido. false não filtra nada.
  overdue?: boolean
  // Só os abertos há mais de N dias (de 1 a 365).
  staleDays?: number
}

// Filtros vazios são omitidos da URL pelo cliente da API. O back ordena do mais
// grave ao menos grave e, dentro da severidade, do mais novo ao mais antigo.
export function listFindings(
  projectId: string,
  params: ListFindingsParams,
  signal?: AbortSignal,
) {
  return api<Paginated<Finding>>(`/projects/${projectId}/findings`, {
    query: params,
    signal,
  })
}
