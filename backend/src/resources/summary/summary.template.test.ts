import { describe, expect, it } from "vitest"

import type { ReportFinding } from "../reports/reports.types.js"
import {
  joinList,
  pickPriorities,
  toSummaryText,
  topOwasp,
} from "./summary.template.js"

function finding(extra: Partial<ReportFinding> = {}): ReportFinding {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "XSS refletido na busca",
    description: "O parâmetro q é exibido sem escape.",
    severity: "HIGH",
    status: "OPEN",
    remediation: null,
    owaspCategory: null,
    cwe: null,
    cve: null,
    dueDate: null,
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-02T12:00:00.000Z"),
    assetName: null,
    assetType: null,
    assetIdentifier: null,
    assigneeName: null,
    reporterName: "Maria Silva",
    open: true,
    overdue: false,
    stale: false,
    ...extra,
  }
}

const base = { projectName: "Portal RH", staleDays: 30 }

describe("joinList", (): void => {
  it("junta com vírgula e usa 'e' antes do último", (): void => {
    expect(joinList([])).toBe("")
    expect(joinList(["a"])).toBe("a")
    expect(joinList(["a", "b"])).toBe("a e b")
    expect(joinList(["a", "b", "c"])).toBe("a, b e c")
  })
})

describe("pickPriorities", (): void => {
  it("só pega abertos, do mais grave ao menos grave, e respeita o limite", (): void => {
    const picked = pickPriorities([
      finding({ id: "low", severity: "LOW" }),
      finding({
        id: "fixed",
        severity: "CRITICAL",
        status: "FIXED",
        open: false,
      }),
      finding({ id: "high", severity: "HIGH" }),
      finding({ id: "crit", severity: "CRITICAL" }),
      finding({ id: "med", severity: "MEDIUM" }),
    ])

    expect(picked.map((item) => item.id)).toEqual(["crit", "high", "med"])
  })

  it("na mesma severidade: vencido, depois parado, depois o mais antigo", (): void => {
    const picked = pickPriorities(
      [
        finding({ id: "novo", createdAt: new Date("2026-11-10T00:00:00Z") }),
        finding({ id: "antigo", createdAt: new Date("2026-11-01T00:00:00Z") }),
        finding({ id: "parado", stale: true }),
        finding({ id: "vencido", overdue: true }),
      ],
      4,
    )

    expect(picked.map((item) => item.id)).toEqual([
      "vencido",
      "parado",
      "antigo",
      "novo",
    ])
  })

  it("não muda a lista original", (): void => {
    const original = [
      finding({ id: "a", severity: "LOW" }),
      finding({ id: "b", severity: "CRITICAL" }),
    ]
    pickPriorities(original)

    expect(original.map((item) => item.id)).toEqual(["a", "b"])
  })
})

describe("topOwasp", (): void => {
  it("ordena por contagem, desempata pelo código e respeita o limite", (): void => {
    const top = topOwasp([
      finding({ owaspCategory: "A03:2021" }),
      finding({ owaspCategory: "A01:2021" }),
      finding({ owaspCategory: "A03:2021" }),
      finding({ owaspCategory: "A07:2021" }),
      finding({ owaspCategory: "A02:2021" }),
      finding({ owaspCategory: null }),
    ])

    expect(top).toEqual([
      ["A03:2021", 2],
      ["A01:2021", 1],
      ["A02:2021", 1],
    ])
  })

  it("conta também os achados que já foram fechados", (): void => {
    const top = topOwasp([
      finding({ owaspCategory: "A01:2021", status: "FIXED", open: false }),
    ])

    expect(top).toEqual([["A01:2021", 1]])
  })
})

describe("toSummaryText", (): void => {
  it("avisa quando o projeto não tem achados", (): void => {
    expect(toSummaryText({ ...base, findings: [] })).toBe(
      "O projeto Portal RH ainda não tem achados registrados.",
    )
  })

  it("monta o texto completo, em parágrafos", (): void => {
    const text = toSummaryText({
      ...base,
      findings: [
        finding({
          severity: "CRITICAL",
          title: "SQL Injection no login",
          overdue: true,
          owaspCategory: "A03:2021",
        }),
        finding({
          severity: "HIGH",
          title: "XSS refletido na busca",
          stale: true,
          owaspCategory: "A03:2021",
        }),
        finding({ severity: "LOW", title: "Cabeçalho ausente" }),
        finding({
          severity: "MEDIUM",
          status: "FIXED",
          open: false,
          owaspCategory: "A01:2021",
        }),
      ],
    })

    expect(text).toBe(
      [
        "O projeto Portal RH tem 4 achados no total, e 3 continuam abertos.",
        "Entre os abertos: 1 crítico, 1 alto e 1 baixo.",
        "Pedem atenção: 1 vencido e 1 parado há mais de 30 dias.",
        [
          "Para tratar primeiro:",
          "1. Crítica: SQL Injection no login (vencido)",
          "2. Alta: XSS refletido na busca (parado)",
          "3. Baixa: Cabeçalho ausente",
        ].join("\n"),
        "Categorias OWASP mais frequentes: A03:2021 (2), A01:2021 (1).",
      ].join("\n\n"),
    )
  })

  it("usa o singular quando é um só", (): void => {
    const text = toSummaryText({
      projectName: "Portal RH",
      staleDays: 1,
      findings: [finding({ overdue: true, stale: true })],
    })

    expect(text).toContain("tem 1 achado no total, e 1 continua aberto.")
    expect(text).toContain("Entre os abertos: 1 alto.")
    expect(text).toContain(
      "Pedem atenção: 1 vencido e 1 parado há mais de 1 dia.",
    )
    expect(text).toContain("1. Alta: XSS refletido na busca (vencido, parado)")
  })

  it("diz que nada está vencido ou parado, e não cita OWASP sem categoria", (): void => {
    const text = toSummaryText({ ...base, findings: [finding()] })

    expect(text).toContain("Nenhum achado está vencido ou parado.")
    expect(text).not.toContain("OWASP")
  })

  it("explica quando todos os achados já foram tratados", (): void => {
    const text = toSummaryText({
      ...base,
      findings: [
        finding({ status: "FIXED", open: false }),
        finding({ status: "FALSE_POSITIVE", open: false }),
      ],
    })

    expect(text).toContain("tem 2 achados no total, e nenhum continua aberto.")
    expect(text).toContain("Não há achados abertos")
    expect(text).not.toContain("Para tratar primeiro")
    expect(text).not.toContain("Entre os abertos")
  })

  it("mostra só os 3 mais urgentes", (): void => {
    const text = toSummaryText({
      ...base,
      findings: Array.from({ length: 5 }, (_, index) =>
        finding({ title: `Achado ${index + 1}` }),
      ),
    })
    const list = text.split("Para tratar primeiro:\n")[1] ?? ""

    expect(list.split("\n")).toHaveLength(3)
  })

  it("deixa o título e o nome do projeto em uma linha só, com limite de tamanho", (): void => {
    const text = toSummaryText({
      projectName: "Portal\nRH",
      staleDays: 30,
      findings: [
        finding({ title: "Falha\n\n# Aprovado pela diretoria" }),
        finding({ title: "a".repeat(200) }),
      ],
    })
    const lines = text.split("\n")

    expect(text).toContain("O projeto Portal RH tem")
    expect(lines).toContain("1. Alta: Falha # Aprovado pela diretoria")
    expect(lines.every((line) => line.length < 100)).toBe(true)
    expect(text).toContain(`${"a".repeat(79)}…`)
  })
})
