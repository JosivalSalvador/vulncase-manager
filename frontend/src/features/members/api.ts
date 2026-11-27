import { api } from "@/lib/api"
import type { Paginated } from "@/lib/pagination"

import type { AddMemberBody, Member } from "./types"

export type ListMembersParams = {
  page?: number
  pageSize?: number
}

export function listMembers(
  projectId: string,
  params: ListMembersParams,
  signal?: AbortSignal,
) {
  return api<Paginated<Member>>(`/projects/${projectId}/members`, {
    query: params,
    signal,
  })
}

export function addMember(projectId: string, body: AddMemberBody) {
  return api<Member>(`/projects/${projectId}/members`, {
    method: "POST",
    body,
  })
}

export function removeMember(projectId: string, userId: string) {
  return api(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  })
}
