import {
  findingStatusSchema,
  severitySchema,
} from "../findings/findings.schema.js"
import type { FindingStatus } from "../findings/findings.types.js"
import type {
  MarkdownReportInput,
  ReportFinding,
  ReportFormat,
  ReportSummary,
  Severity,
} from "./reports.types.js"

// Este arquivo só tem funções puras (sem banco e sem env): recebe os dados
// prontos e devolve texto. É o que torna o formato fácil de testar.

const severities = severitySchema.options
const statuses = findingStatusSchema.options

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  INFO: "Informativa",
}

const STATUS_LABEL: Record<FindingStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  FIXED: "Corrigido",
  VERIFIED: "Verificado",
  ACCEPTED_RISK: "Risco aceito",
  FALSE_POSITIVE: "Falso positivo",
}

export const REPORT_CONTENT_TYPE: Record<ReportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
}

const iso = (date: Date): string => date.toISOString()

// Data pura (o prazo é guardado como meia-noite UTC): o dia em UTC é o certo.
const day = (date: Date): string => date.toISOString().slice(0, 10)

// Dia do calendário de um INSTANTE (criação, atualização) no fuso informado.
// O locale "en-CA" formata como AAAA-MM-DD. Sem isso, um achado criado às 21h
// em Manaus apareceria com a data do dia seguinte (UTC).
function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date)
}

// Do mais grave para o menos grave. O sort é estável, então dentro de cada
// severidade a ordem de criação que veio do banco é mantida.
function sortBySeverity(findings: ReportFinding[]): ReportFinding[] {
  return [...findings].sort(
    (a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity),
  )
}

export function summarize(findings: ReportFinding[]): ReportSummary {
  const bySeverity = Object.fromEntries(
    severities.map((key) => [key, 0]),
  ) as Record<Severity, number>
  const byStatus = Object.fromEntries(
    statuses.map((key) => [key, 0]),
  ) as Record<FindingStatus, number>
  let open = 0
  let overdue = 0
  let stale = 0

  for (const finding of findings) {
    bySeverity[finding.severity] += 1
    byStatus[finding.status] += 1
    if (finding.open) open += 1
    if (finding.overdue) overdue += 1
    if (finding.stale) stale += 1
  }

  return { total: findings.length, open, overdue, stale, bySeverity, byStatus }
}

// Nome de arquivo seguro: só a-z, 0-9 e hífen, sem acento.
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 50)
    .replace(/-+$/, "")
  return slug || "projeto"
}

export function reportFilename(
  projectName: string,
  generatedOn: string,
  format: ReportFormat,
): string {
  return `relatorio-${slugify(projectName)}-${generatedOn}.${format}`
}

// ---------- CSV ----------

// Sem o BOM, o Excel abre o arquivo como ANSI e estraga os acentos.
const BOM = "\uFEFF"

// Planilhas leem texto iniciado por = + - @ (ou tab/CR) como FÓRMULA, e o
// título, a descrição e os nomes vêm do usuário ("CSV injection"). O
// apóstrofo na frente faz a planilha tratar o conteúdo como texto.
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

type CsvColumn = readonly [
  header: string,
  value: (finding: ReportFinding) => string,
]

const yesNo = (flag: boolean): string => (flag ? "sim" : "nao")

const CSV_COLUMNS: readonly CsvColumn[] = [
  ["id", (f) => f.id],
  ["titulo", (f) => f.title],
  ["severidade", (f) => f.severity],
  ["status", (f) => f.status],
  ["ativo", (f) => f.assetName ?? ""],
  ["tipo_ativo", (f) => f.assetType ?? ""],
  ["identificador_ativo", (f) => f.assetIdentifier ?? ""],
  ["responsavel", (f) => f.assigneeName ?? ""],
  ["relator", (f) => f.reporterName],
  ["owasp", (f) => f.owaspCategory ?? ""],
  ["cwe", (f) => f.cwe ?? ""],
  ["cve", (f) => f.cve ?? ""],
  ["prazo", (f) => (f.dueDate ? day(f.dueDate) : "")],
  ["vencido", (f) => yesNo(f.overdue)],
  ["parado", (f) => yesNo(f.stale)],
  ["criado_em", (f) => iso(f.createdAt)],
  ["atualizado_em", (f) => iso(f.updatedAt)],
  ["descricao", (f) => f.description],
  ["correcao_proposta", (f) => f.remediation ?? ""],
]

export function toCsv(findings: ReportFinding[]): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(",")
  const rows = sortBySeverity(findings).map((finding) =>
    CSV_COLUMNS.map(([, value]) => csvCell(value(finding))).join(","),
  )
  // CRLF é o fim de linha do padrão CSV (RFC 4180).
  return BOM + [header, ...rows].join("\r\n") + "\r\n"
}

// ---------- Markdown ----------

// Tudo que o usuário escreveu pode ter marcação (HTML, link, título). Estes
// caracteres ganham uma barra na frente, para o texto aparecer como texto.
const MD_SPECIAL = /[\\`*_[\]<>&|#~]/g

function mdEscape(text: string): string {
  return text.replace(MD_SPECIAL, "\\$&")
}

// Uma linha só: quebras de linha viram espaço, senão um título com "\n# ..."
// criaria um título falso no relatório.
function mdInline(text: string): string {
  return mdEscape(text.replace(/\s+/g, " ").trim())
}

// Texto de várias linhas, dentro de uma citação (">"). Os dois espaços no fim
// de uma linha forçam a quebra, para os passos de uma descrição não se
// juntarem em um parágrafo só. A última linha de cada parágrafo não precisa.
function mdBlock(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  return lines.map((line, index) => {
    if (line.trim() === "") return ">"
    const continues = (lines[index + 1] ?? "").trim() !== ""
    return `> ${mdEscape(line)}${continues ? "  " : ""}`
  })
}

function findingMarkdown(
  finding: ReportFinding,
  index: number,
  timeZone: string,
): string[] {
  const asset = finding.assetName
    ? `${mdInline(finding.assetName)} (${finding.assetType ?? "sem tipo"})`
    : "sem ativo"
  const due = finding.dueDate
    ? `${day(finding.dueDate)}${finding.overdue ? " (vencido)" : ""}`
    : "sem prazo"

  const lines = [
    `#### ${index}. ${mdInline(finding.title)}`,
    "",
    `- **Status:** ${STATUS_LABEL[finding.status]}${finding.stale ? " (parado)" : ""}`,
    `- **Ativo:** ${asset}`,
    `- **Responsável:** ${mdInline(finding.assigneeName ?? "não atribuído")}`,
    `- **Relator:** ${mdInline(finding.reporterName)}`,
  ]
  if (finding.owaspCategory) {
    lines.push(`- **OWASP:** ${mdInline(finding.owaspCategory)}`)
  }
  if (finding.cwe) {
    lines.push(`- **CWE:** ${mdInline(finding.cwe)}`)
  }
  if (finding.cve) {
    lines.push(`- **CVE:** ${mdInline(finding.cve)}`)
  }
  lines.push(
    `- **Prazo:** ${due}`,
    `- **Criado em:** ${localDay(finding.createdAt, timeZone)}`,
    `- **Atualizado em:** ${localDay(finding.updatedAt, timeZone)}`,
    `- **ID:** \`${finding.id}\``,
    "",
    "**Descrição**",
    "",
    ...mdBlock(finding.description),
    "",
    "**Correção proposta**",
    "",
    ...(finding.remediation
      ? mdBlock(finding.remediation)
      : ["_Não informada._"]),
    "",
  )
  return lines
}

function countTable(
  title: string,
  rows: readonly (readonly [label: string, count: number])[],
): string[] {
  return [
    `| ${title} | Total |`,
    "| --- | ---: |",
    ...rows.map(([label, count]) => `| ${label} | ${count} |`),
    "",
  ]
}

export function toMarkdown(input: MarkdownReportInput): string {
  const { project, generatedOn, timeZone, staleDays, findings } = input
  const summary = summarize(findings)

  const lines = [
    `# Relatório de vulnerabilidades: ${mdInline(project.name)}`,
    "",
    `Gerado em ${generatedOn}. Um achado é **vencido** quando o prazo é anterior a hoje e **parado** quando está aberto há mais de ${staleDays} dias. Só os status Aberto e Em andamento contam como abertos.`,
    "",
  ]
  if (project.description) {
    lines.push(...mdBlock(project.description), "")
  }

  lines.push(
    "## Resumo em números",
    "",
    ...countTable("Indicador", [
      ["Achados", summary.total],
      ["Abertos", summary.open],
      ["Vencidos", summary.overdue],
      [`Parados (mais de ${staleDays} dias)`, summary.stale],
    ]),
    "### Por severidade",
    "",
    ...countTable(
      "Severidade",
      severities.map((key) => [SEVERITY_LABEL[key], summary.bySeverity[key]]),
    ),
    "### Por status",
    "",
    ...countTable(
      "Status",
      statuses.map((key) => [STATUS_LABEL[key], summary.byStatus[key]]),
    ),
    "## Achados",
    "",
  )

  if (findings.length === 0) {
    lines.push("Nenhum achado registrado neste projeto.", "")
    return lines.join("\n") + "\n"
  }

  let index = 0
  for (const severity of severities) {
    const group = findings.filter((finding) => finding.severity === severity)
    if (group.length === 0) continue

    lines.push(`### ${SEVERITY_LABEL[severity]} (${group.length})`, "")
    for (const finding of group) {
      index += 1
      lines.push(...findingMarkdown(finding, index, timeZone))
    }
  }

  return lines.join("\n") + "\n"
}
