import { describe, expect, it } from "vitest"

import {
  csvCell,
  reportFilename,
  slugify,
  summarize,
  toCsv,
  toMarkdown,
} from "./reports.format.js"
import type { ReportFinding } from "./reports.types.js"

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

const project = { name: "Portal RH", description: null }

describe("csvCell", (): void => {
  it("deixa o texto simples como está", (): void => {
    expect(csvCell("XSS refletido")).toBe("XSS refletido")
  })

  it("coloca entre aspas o que tem vírgula, aspas ou quebra de linha", (): void => {
    expect(csvCell("a, b")).toBe('"a, b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"')
  })

  it("neutraliza fórmulas de planilha (CSV injection)", (): void => {
    expect(csvCell("=1+1")).toBe("'=1+1")
    expect(csvCell("+cmd")).toBe("'+cmd")
    expect(csvCell("-2+3")).toBe("'-2+3")
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(csvCell('=HYPERLINK("http://x","clique")')).toBe(
      '"\'=HYPERLINK(""http://x"",""clique"")"',
    )
  })

  it("não mexe em texto que só tem esses caracteres no meio", (): void => {
    expect(csvCell("CWE-89")).toBe("CWE-89")
    expect(csvCell("a=b")).toBe("a=b")
  })
})

describe("toCsv", (): void => {
  it("começa com BOM, termina com CRLF e tem o cabeçalho", (): void => {
    const csv = toCsv([finding()])

    expect(csv.startsWith("\uFEFFid,titulo,severidade,status,")).toBe(true)
    expect(csv.endsWith("\r\n")).toBe(true)
    expect(csv.split("\r\n")).toHaveLength(3)
  })

  it("ordena do mais grave para o menos grave", (): void => {
    const csv = toCsv([
      finding({ id: "a", severity: "LOW", title: "Baixo" }),
      finding({ id: "b", severity: "CRITICAL", title: "Crítico" }),
      finding({ id: "c", severity: "HIGH", title: "Alto" }),
    ])
    const ids = csv
      .split("\r\n")
      .slice(1, 4)
      .map((row) => row.split(",")[0])

    expect(ids).toEqual(["b", "c", "a"])
  })

  it("escreve prazo como data e vencido/parado como sim ou nao", (): void => {
    const csv = toCsv([
      finding({
        dueDate: new Date("2020-01-01T00:00:00.000Z"),
        overdue: true,
      }),
    ])
    const row = csv.split("\r\n")[1] ?? ""

    expect(row).toContain(",2020-01-01,sim,nao,")
    expect(row).toContain("2026-11-01T12:00:00.000Z")
  })

  it("neutraliza fórmula no título", (): void => {
    const csv = toCsv([finding({ title: "=cmd|' /C calc'!A0" })])

    expect(csv).toContain(",'=cmd|' /C calc'!A0,")
  })
})

describe("slugify e reportFilename", (): void => {
  it("tira acento, caixa e símbolos", (): void => {
    expect(slugify("Portal do RH — Versão 2!")).toBe("portal-do-rh-versao-2")
  })

  it("nunca devolve vazio", (): void => {
    expect(slugify("???")).toBe("projeto")
  })

  it("limita o tamanho e não termina em hífen", (): void => {
    const slug = slugify(`${"a".repeat(49)} b`)

    expect(slug.length).toBeLessThanOrEqual(50)
    expect(slug.endsWith("-")).toBe(false)
  })

  it("monta o nome do arquivo com a data e a extensão", (): void => {
    expect(reportFilename("Portal RH", "2026-11-22", "csv")).toBe(
      "relatorio-portal-rh-2026-11-22.csv",
    )
    expect(reportFilename("Portal RH", "2026-11-22", "md")).toBe(
      "relatorio-portal-rh-2026-11-22.md",
    )
  })
})

describe("summarize", (): void => {
  it("conta por severidade e status, incluindo os zeros", (): void => {
    const summary = summarize([
      finding({ severity: "CRITICAL", overdue: true }),
      finding({ severity: "CRITICAL", status: "FIXED", open: false }),
      finding({ severity: "LOW", stale: true }),
    ])

    expect(summary.total).toBe(3)
    expect(summary.open).toBe(2)
    expect(summary.overdue).toBe(1)
    expect(summary.stale).toBe(1)
    expect(summary.bySeverity).toEqual({
      CRITICAL: 2,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 1,
      INFO: 0,
    })
    expect(summary.byStatus.FIXED).toBe(1)
    expect(summary.byStatus.VERIFIED).toBe(0)
  })
})

describe("toMarkdown", (): void => {
  const base = {
    project,
    generatedOn: "2026-11-22",
    timeZone: "America/Manaus",
    staleDays: 30,
  }

  it("monta título, resumo e os achados agrupados por severidade", (): void => {
    const md = toMarkdown({
      ...base,
      findings: [
        finding({ id: "a", severity: "LOW", title: "Baixo" }),
        finding({ id: "b", severity: "CRITICAL", title: "Crítico" }),
      ],
    })

    expect(md).toContain("# Relatório de vulnerabilidades: Portal RH")
    expect(md).toContain("Gerado em 2026-11-22.")
    expect(md).toContain("| Achados | 2 |")
    expect(md).toContain("### Crítica (1)")
    expect(md).toContain("### Baixa (1)")
    expect(md).not.toContain("### Alta")
    expect(md.indexOf("#### 1. Crítico")).toBeLessThan(
      md.indexOf("#### 2. Baixo"),
    )
  })

  it("mostra prazo vencido, parado e a correção proposta", (): void => {
    const md = toMarkdown({
      ...base,
      findings: [
        finding({
          dueDate: new Date("2020-01-01T00:00:00.000Z"),
          overdue: true,
          stale: true,
          remediation: "Escapar a saída.",
          owaspCategory: "A03:2021",
          cwe: "CWE-79",
        }),
      ],
    })

    expect(md).toContain("- **Status:** Aberto (parado)")
    expect(md).toContain("- **Prazo:** 2020-01-01 (vencido)")
    expect(md).toContain("- **OWASP:** A03:2021")
    expect(md).toContain("- **CWE:** CWE-79")
    expect(md).toContain("> Escapar a saída.")
  })

  it("avisa quando a correção não foi informada", (): void => {
    const md = toMarkdown({ ...base, findings: [finding()] })

    expect(md).toContain("_Não informada._")
  })

  it("escapa marcação do usuário em vez de deixá-la valer", (): void => {
    const md = toMarkdown({
      ...base,
      findings: [
        finding({
          title: "<img src=x onerror=alert(1)> [link](http://x)",
          description: "# título falso\n<script>alert(1)</script>",
        }),
      ],
    })

    expect(md).toContain(
      "#### 1. \\<img src=x onerror=alert(1)\\> \\[link\\](http://x)",
    )
    expect(md).toContain("> \\# título falso")
    expect(md).toContain("> \\<script\\>alert(1)\\</script\\>")
    expect(md.toLowerCase()).not.toContain("<script>")
  })

  it("não deixa uma quebra de linha no título criar um título falso", (): void => {
    const md = toMarkdown({
      ...base,
      findings: [finding({ title: "Falha\n# Aprovado pela diretoria" })],
    })

    expect(md).toContain("#### 1. Falha \\# Aprovado pela diretoria")
    expect(md).not.toMatch(/^# Aprovado/m)
  })

  it("mantém as quebras de linha da descrição, sem espaço sobrando no fim", (): void => {
    const md = toMarkdown({
      ...base,
      findings: [
        finding({ description: "Passo 1\nPasso 2\n\nOutro parágrafo" }),
      ],
    })

    expect(md).toContain("> Passo 1  \n> Passo 2\n>\n> Outro parágrafo\n")
  })

  it("mostra criação e atualização no dia do fuso configurado", (): void => {
    // 01:00 UTC do dia 23 ainda é 21:00 do dia 22 em Manaus (UTC-4).
    const md = toMarkdown({
      ...base,
      findings: [
        finding({
          createdAt: new Date("2026-11-23T01:00:00.000Z"),
          updatedAt: new Date("2026-11-23T05:00:00.000Z"),
        }),
      ],
    })

    expect(md).toContain("- **Criado em:** 2026-11-22")
    expect(md).toContain("- **Atualizado em:** 2026-11-23")
  })

  it("avisa quando o projeto não tem achados", (): void => {
    const md = toMarkdown({ ...base, findings: [] })

    expect(md).toContain("Nenhum achado registrado neste projeto.")
    expect(md).toContain("| Achados | 0 |")
  })
})
