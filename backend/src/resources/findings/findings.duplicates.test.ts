import { describe, expect, it } from "vitest"

import {
  rankDuplicates,
  titleSimilarity,
  titleTokens,
} from "./findings.duplicates.js"

function candidate(
  id: string,
  title: string,
  extra: { cwe?: string; cve?: string } = {},
) {
  return { id, title, cwe: extra.cwe ?? null, cve: extra.cve ?? null }
}

describe("titleTokens", (): void => {
  it("ignora acento, maiúsculas, pontuação e palavras comuns", (): void => {
    expect(titleTokens("Injeção de SQL, no Login!")).toEqual(
      new Set(["injecao", "sql", "login"]),
    )
  })
})

describe("titleSimilarity", (): void => {
  it("dá 1 para títulos iguais, mesmo com acento e caixa diferentes", (): void => {
    expect(
      titleSimilarity("XSS refletido na busca", "xss Refletido na BUSCA"),
    ).toBe(1)
  })

  it("dá valor alto para títulos que só diferem em algumas palavras", (): void => {
    expect(
      titleSimilarity(
        "XSS refletido na busca",
        "XSS refletido no campo de busca",
      ),
    ).toBeGreaterThanOrEqual(0.6)
  })

  it("dá valor baixo para assuntos diferentes", (): void => {
    expect(
      titleSimilarity(
        "Falta de rate limit no login",
        "Falta de validação no login",
      ),
    ).toBeLessThan(0.6)
    expect(titleSimilarity("XSS refletido", "Porta SSH aberta")).toBe(0)
  })

  it("dá 0 quando um dos títulos não tem palavras úteis", (): void => {
    expect(titleSimilarity("de a o", "XSS refletido")).toBe(0)
  })
})

describe("rankDuplicates", (): void => {
  it("encontra o achado com título parecido", (): void => {
    const result = rankDuplicates({ title: "XSS refletido na busca" }, [
      candidate("1", "Porta SSH aberta"),
      candidate("2", "XSS refletido no campo de busca"),
    ])

    expect(result.map((match) => match.finding.id)).toEqual(["2"])
    expect(result[0]?.reasons).toEqual(["Título parecido"])
  })

  it("trata o mesmo CVE como duplicata, mesmo com título diferente", (): void => {
    const result = rankDuplicates(
      { title: "Biblioteca desatualizada", cve: "CVE-2024-12345" },
      [
        candidate("1", "Log4Shell no serviço de logs", {
          cve: "CVE-2024-12345",
        }),
      ],
    )

    expect(result).toHaveLength(1)
    expect(result[0]?.reasons).toEqual(["Mesmo CVE"])
  })

  it("só o mesmo CWE não basta, mas CWE com palavras em comum basta", (): void => {
    const probe = { title: "XSS no campo de busca", cwe: "CWE-79" }

    expect(
      rankDuplicates(probe, [
        candidate("1", "Injeção em comentários", { cwe: "CWE-79" }),
      ]),
    ).toEqual([])

    const result = rankDuplicates(probe, [
      candidate("2", "XSS armazenado no campo de comentários", {
        cwe: "CWE-79",
      }),
    ])
    expect(result.map((match) => match.finding.id)).toEqual(["2"])
    expect(result[0]?.reasons).toEqual(["Mesmo CWE", "Título parecido"])
  })

  it("ordena do mais parecido ao menos parecido e respeita o limite", (): void => {
    const result = rankDuplicates(
      { title: "SQL Injection no login", cve: "CVE-2025-0001" },
      [
        candidate("1", "SQL Injection no login do portal"),
        candidate("2", "SQL Injection no login"),
        candidate("3", "Outro assunto", { cve: "CVE-2025-0001" }),
      ],
      2,
    )

    expect(result.map((match) => match.finding.id)).toEqual(["3", "2"])
  })
})
