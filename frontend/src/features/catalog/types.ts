// Resposta do GET /catalog/owasp.
export type OwaspEntry = {
  code: string
  edition: "2021" | "2025"
  // Nome oficial, em inglês.
  name: string
  // Tradução para exibição.
  namePt: string
}
