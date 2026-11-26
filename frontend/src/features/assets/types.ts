import type { AssetType } from "./labels"

// Resposta do back para um ativo.
export type Asset = {
  id: string
  name: string
  type: AssetType
  // URL, IP, nome do pacote, repositório...
  identifier: string | null
  projectId: string
  createdAt: string
  updatedAt: string
}

// Corpo do POST e do PATCH (o formulário de edição manda os três campos).
export type AssetBody = {
  name: string
  type: AssetType
  identifier: string | null
}
