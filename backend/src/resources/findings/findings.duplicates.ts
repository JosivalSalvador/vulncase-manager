// Detecção básica de achados duplicados, sem dependências externas.
// São funções puras (não falam com o banco), o que facilita o teste.

export interface DuplicateProbe {
  title: string
  cwe?: string | null | undefined
  cve?: string | null | undefined
}

export interface DuplicateCandidate {
  id: string
  title: string
  cwe: string | null
  cve: string | null
}

export interface DuplicateMatch<T extends DuplicateCandidate> {
  finding: T
  similarity: number
  reasons: string[]
}

// Título parecido por si só já basta a partir deste valor (0 a 1).
const TITLE_THRESHOLD = 0.6
// Com o mesmo CWE, basta o título ter palavras em comum.
const TITLE_THRESHOLD_WITH_CWE = 0.3

// Palavras comuns que não ajudam a diferenciar um título do outro.
const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "e",
  "ou",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "com",
  "sem",
  "por",
  "para",
  "um",
  "uma",
  "the",
  "of",
  "in",
  "on",
  "and",
  "for",
  "to",
])

// Minúsculas, sem acento e sem pontuação, só com as palavras que importam.
export function titleTokens(title: string): Set<string> {
  const normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")

  return new Set(
    normalized
      .split(" ")
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
  )
}

// Similaridade de Jaccard entre as palavras dos dois títulos:
// palavras em comum dividido pelo total de palavras diferentes (0 a 1).
export function titleSimilarity(a: string, b: string): number {
  const tokensA = titleTokens(a)
  const tokensB = titleTokens(b)
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0
  }

  let shared = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      shared += 1
    }
  }
  return shared / (tokensA.size + tokensB.size - shared)
}

// Escolhe, entre os candidatos, os que parecem repetir o achado novo.
// É duplicata provável quando: o CVE é o mesmo, OU o título é parecido, OU o
// CWE é o mesmo e os títulos têm palavras em comum. Só o mesmo CWE não basta:
// dois XSS em campos diferentes do mesmo ativo são achados distintos.
export function rankDuplicates<T extends DuplicateCandidate>(
  probe: DuplicateProbe,
  candidates: T[],
  limit = 5,
): DuplicateMatch<T>[] {
  const matches: Array<DuplicateMatch<T> & { score: number }> = []

  for (const candidate of candidates) {
    const similarity = titleSimilarity(probe.title, candidate.title)
    const sameCve = Boolean(probe.cve) && probe.cve === candidate.cve
    const sameCwe = Boolean(probe.cwe) && probe.cwe === candidate.cwe
    const similarTitle =
      similarity >= TITLE_THRESHOLD ||
      (sameCwe && similarity >= TITLE_THRESHOLD_WITH_CWE)

    if (!sameCve && !similarTitle) {
      continue
    }

    const reasons: string[] = []
    if (sameCve) reasons.push("Mesmo CVE")
    if (sameCwe) reasons.push("Mesmo CWE")
    if (similarTitle) reasons.push("Título parecido")

    matches.push({
      finding: candidate,
      similarity: Math.round(similarity * 100) / 100,
      reasons,
      // O mesmo CVE pesa mais que qualquer título (a similaridade vai até 1).
      score: similarity + (sameCve ? 2 : 0) + (sameCwe ? 0.2 : 0),
    })
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ finding, similarity, reasons }) => ({
      finding,
      similarity,
      reasons,
    }))
}
