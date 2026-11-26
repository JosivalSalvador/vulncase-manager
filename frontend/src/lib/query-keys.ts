// Chaves do cache do TanStack Query, num lugar só para não divergirem.
export const queryKeys = {
  currentUser: ["auth", "me"] as const,
  overallStats: ["stats", "overall"] as const,
  // Prefixo de tudo sobre projetos: invalidar ele atinge todas as listas.
  projects: ["projects"] as const,
  projectList: (params: object) => ["projects", "list", params] as const,
}
