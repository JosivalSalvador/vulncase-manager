// Chaves do cache do TanStack Query, num lugar só para não divergirem.
export const queryKeys = {
  currentUser: ["auth", "me"] as const,
  overallStats: ["stats", "overall"] as const,
  // Prefixo de tudo sobre projetos: invalidar ele atinge listas e detalhes.
  projects: ["projects"] as const,
  projectList: (params: object) => ["projects", "list", params] as const,
  projectDetail: (id: string) => ["projects", "detail", id] as const,
  // Números que saem dos achados (painel, resumo): quem mexer em achado deve
  // invalidar o prefixo projectNumbers.
  projectNumbers: (id: string) => ["projects", "numbers", id] as const,
  projectStats: (id: string) => ["projects", "numbers", id, "stats"] as const,
  projectSummary: (id: string) =>
    ["projects", "numbers", id, "summary"] as const,
  // Ativos de um projeto: o prefixo pega todas as listas dele. Fica debaixo de
  // ["projects"], então apagar o projeto também limpa os ativos do cache.
  projectAssets: (id: string) => ["projects", "assets", id] as const,
  assetList: (id: string, params: object) =>
    ["projects", "assets", id, "list", params] as const,
  // Membros de um projeto: mesma ideia dos ativos (prefixo pega as listas).
  projectMembers: (id: string) => ["projects", "members", id] as const,
  memberList: (id: string, params: object) =>
    ["projects", "members", id, "list", params] as const,
  // Achados de um projeto: mesma ideia dos ativos (prefixo pega as listas).
  projectFindings: (id: string) => ["projects", "findings", id] as const,
  findingList: (id: string, params: object) =>
    ["projects", "findings", id, "list", params] as const,
  // Fica fora do prefixo dos achados: salvar não pode refazer esta consulta com
  // o formulário aberto, senão o achado novo apareceria como duplicata dele.
  findingDuplicates: (id: string, params: object | null) =>
    ["projects", "duplicates", id, params] as const,
  owaspCatalog: ["catalog", "owasp"] as const,
  cweCatalog: ["catalog", "cwe"] as const,
}
