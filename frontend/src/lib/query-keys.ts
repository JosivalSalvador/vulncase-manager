// Chaves do cache do TanStack Query, num lugar só para não divergirem.
export const queryKeys = {
  currentUser: ["auth", "me"] as const,
  overallStats: ["stats", "overall"] as const,
}
