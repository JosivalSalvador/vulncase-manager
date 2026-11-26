import { api } from "@/lib/api"
import type { Paginated } from "@/lib/pagination"

import type { Project, ProjectBody } from "./types"

export type ListProjectsParams = {
  page?: number
  pageSize?: number
  search?: string
}

// Busca vazia é omitida da URL pelo cliente da API.
export function listProjects(params: ListProjectsParams, signal?: AbortSignal) {
  return api<Paginated<Project>>("/projects", { query: params, signal })
}

export function createProject(body: ProjectBody) {
  return api<Project>("/projects", { method: "POST", body })
}

export function updateProject(id: string, body: ProjectBody) {
  return api<Project>(`/projects/${id}`, { method: "PATCH", body })
}

export function deleteProject(id: string) {
  return api(`/projects/${id}`, { method: "DELETE" })
}

export function fetchProject(id: string, signal?: AbortSignal) {
  return api<Project>(`/projects/${id}`, { signal })
}
