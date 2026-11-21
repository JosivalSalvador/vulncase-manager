import { cweCatalog, owaspCatalog } from "./catalog.data.js"
import type { CweQuery, OwaspQuery } from "./catalog.types.js"

export function listOwasp(query: OwaspQuery) {
  const { edition } = query
  return edition
    ? owaspCatalog.filter((entry) => entry.edition === edition)
    : owaspCatalog
}

// Busca pelo código ("89", "CWE-89") ou por parte do nome ("sql").
export function listCwe(query: CweQuery) {
  const term = query.search?.toLowerCase()
  if (!term) {
    return cweCatalog
  }
  return cweCatalog.filter(
    (entry) =>
      entry.code.toLowerCase().includes(term) ||
      entry.name.toLowerCase().includes(term),
  )
}
