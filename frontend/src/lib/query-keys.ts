// Chaves do cache do TanStack Query, num lugar só para não divergirem.
export const queryKeys = {
  currentUser: ["auth", "me"] as const,
  overallStats: ["stats", "overall"] as const,
  // Prefixo de tudo sobre projetos: invalidar ele atinge listas e detalhes.
  projects: ["projects"] as const,
  projectList: (params: object) => ["projects", "list", params] as const,
  projectDetail: (id: string) => ["projects", "detail", id] as const,
  // Números que saem dos achados (painel, resumo): quem mexer em achado deve
  // invalidar o prefixo ["projects", "numbers", id].
  projectStats: (id: string) => ["projects", "numbers", id, "stats"] as const,
  owaspCatalog: ["catalog", "owasp"] as const,
}
