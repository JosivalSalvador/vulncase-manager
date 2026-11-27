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

// Corpo do POST e do PATCH (o formulário manda todos os campos). O status não
// entra: ele muda por uma rota própria, que grava o histórico.
export type FindingBody = {
  title: string
  description: string
  severity: Severity
  remediation: string | null
  owaspCategory: string | null
  cwe: string | null
  cve: string | null
  // Só o dia: "AAAA-MM-DD".
  dueDate: string | null
  assetId: string | null
  assigneeId: string | null
}

// Um achado aberto parecido com o que está sendo cadastrado.
export type PossibleDuplicate = {
  finding: Pick<
    Finding,
    "id" | "title" | "severity" | "status" | "cwe" | "cve" | "createdAt"
  >
  // Semelhança entre os títulos, de 0 a 1.
  similarity: number
  // Ex.: "Mesmo CWE", "Título parecido".
  reasons: string[]
}

// O POST devolve o achado criado e os parecidos que já existiam.
export type CreatedFinding = Finding & {
  possibleDuplicates: PossibleDuplicate[]
}
