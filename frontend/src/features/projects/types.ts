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
