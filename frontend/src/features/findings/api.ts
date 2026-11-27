import { api } from "@/lib/api"
import type { Paginated } from "@/lib/pagination"

import type { FindingStatus, Severity } from "./labels"
import type {
  CreatedFinding,
  Finding,
  FindingBody,
  PossibleDuplicate,
} from "./types"

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

export function createFinding(projectId: string, body: FindingBody) {
  return api<CreatedFinding>(`/projects/${projectId}/findings`, {
    method: "POST",
    body,
  })
}

export function updateFinding(
  projectId: string,
  findingId: string,
  body: FindingBody,
) {
  return api<Finding>(`/projects/${projectId}/findings/${findingId}`, {
    method: "PATCH",
    body,
  })
}

export function deleteFinding(projectId: string, findingId: string) {
  return api(`/projects/${projectId}/findings/${findingId}`, {
    method: "DELETE",
  })
}

export type DuplicatesParams = {
  title: string
  assetId?: string
  cwe?: string
  cve?: string
}

export function listDuplicates(
  projectId: string,
  params: DuplicatesParams,
  signal?: AbortSignal,
) {
  return api<{ data: PossibleDuplicate[] }>(
    `/projects/${projectId}/findings/duplicates`,
    { query: params, signal },
  )
}
