import type { AssetType } from "@/features/assets/labels"

import type { FindingStatus, Severity } from "./labels"

// Ativo e pessoas que o back manda junto do achado.
export type FindingAsset = { id: string; name: string; type: AssetType }
export type FindingPerson = { id: string; fullname: string }

// Resposta do back para um achado.
export type Finding = {
  id: string
  title: string
  description: string
  severity: Severity
  status: FindingStatus
  // Correção proposta.
  remediation: string | null
  // Ex.: "A03:2021", "CWE-89", "CVE-2024-12345".
  owaspCategory: string | null
  cwe: string | null
  cve: string | null
  // Prazo (só o dia, em ISO).
  dueDate: string | null
  projectId: string
  assetId: string | null
  reporterId: string
  assigneeId: string | null
  createdAt: string
  updatedAt: string
  asset: FindingAsset | null
  assignee: FindingPerson | null
  reporter: FindingPerson
}
