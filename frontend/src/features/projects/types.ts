// Resposta do back para um projeto.
export type Project = {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

// Corpo do POST e do PATCH.
export type ProjectBody = { name: string; description: string | null }

// Resposta do GET /projects/:id/summary. O back manda também "numbers", que o
// painel já tem pelo /stats.
export type AutoSummary = {
  // Dia no formato AAAA-MM-DD.
  generatedOn: string
  staleDays: number
  // Parágrafos separados por uma linha em branco.
  text: string
}
