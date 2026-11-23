import { severitySchema } from "../findings/findings.schema.js"
import { SEVERITY_LABEL, summarize } from "../reports/reports.format.js"
import type { ReportFinding, Severity } from "../reports/reports.types.js"
import type { SummaryTextInput } from "./summary.types.js"

// Só funções puras (sem banco e sem env): recebem os achados prontos e devolvem
// texto. O resumo é montado por TEMPLATE: frases fixas com os números e os
// nomes encaixados. Não há IA, então o mesmo projeto sempre gera o mesmo texto.

const severities = severitySchema.options

const PRIORITY_LIMIT = 3
const OWASP_LIMIT = 3
const TEXT_MAX = 80

// Concordância de "N crítico(s)", usada na frase dos achados abertos.
const SEVERITY_COUNT_LABEL: Record<
  Severity,
  readonly [singular: string, plural: string]
> = {
  CRITICAL: ["crítico", "críticos"],
  HIGH: ["alto", "altos"],
  MEDIUM: ["médio", "médios"],
  LOW: ["baixo", "baixos"],
  INFO: ["informativo", "informativos"],
}

function plural(count: number, singular: string, many: string): string {
  return count === 1 ? singular : many
}

// "a", "a e b", "a, b e c".
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("")
  const last = items[items.length - 1] ?? ""
  return `${items.slice(0, -1).join(", ")} e ${last}`
}

// Título e nome do projeto vêm do usuário: viram uma linha só (uma quebra de
// linha no meio quebraria a lista) e ganham um limite de tamanho.
function oneLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > TEXT_MAX
    ? `${clean.slice(0, TEXT_MAX - 1).trimEnd()}…`
    : clean
}

// Os mais urgentes entre os abertos. Do mais grave para o menos grave; na mesma
// severidade, primeiro o vencido, depois o parado e, por fim, o mais antigo.
export function pickPriorities(
  findings: ReportFinding[],
  limit: number = PRIORITY_LIMIT,
): ReportFinding[] {
  return findings
    .filter((finding) => finding.open)
    .sort(
      (a, b) =>
        severities.indexOf(a.severity) - severities.indexOf(b.severity) ||
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.stale) - Number(a.stale) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .slice(0, limit)
}

// Categorias OWASP mais citadas (em todos os achados, como no dashboard). Na
// mesma contagem, a ordem do código desempata.
export function topOwasp(
  findings: ReportFinding[],
  limit: number = OWASP_LIMIT,
): [code: string, count: number][] {
  const counts = new Map<string, number>()
  for (const finding of findings) {
    if (finding.owaspCategory) {
      const code = finding.owaspCategory
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

function overviewParagraph(name: string, total: number, open: number): string {
  const state =
    open === 0
      ? "nenhum continua aberto"
      : `${open} ${plural(open, "continua aberto", "continuam abertos")}`
  return `O projeto ${name} tem ${total} ${plural(total, "achado", "achados")} no total, e ${state}.`
}

function openBySeverityParagraph(findings: ReportFinding[]): string {
  const parts = severities.flatMap((severity) => {
    const count = findings.filter(
      (finding) => finding.open && finding.severity === severity,
    ).length
    const [one, many] = SEVERITY_COUNT_LABEL[severity]
    return count > 0 ? [`${count} ${plural(count, one, many)}`] : []
  })
  return `Entre os abertos: ${joinList(parts)}.`
}

function attentionParagraph(
  overdue: number,
  stale: number,
  staleDays: number,
): string {
  const parts: string[] = []
  if (overdue > 0) {
    parts.push(`${overdue} ${plural(overdue, "vencido", "vencidos")}`)
  }
  if (stale > 0) {
    parts.push(
      `${stale} ${plural(stale, "parado", "parados")} há mais de ${staleDays} ${plural(staleDays, "dia", "dias")}`,
    )
  }
  return parts.length === 0
    ? "Nenhum achado está vencido ou parado."
    : `Pedem atenção: ${joinList(parts)}.`
}

function prioritiesParagraph(findings: ReportFinding[]): string {
  const lines = pickPriorities(findings).map((finding, index) => {
    const tags = [
      finding.overdue ? "vencido" : "",
      finding.stale ? "parado" : "",
    ].filter(Boolean)
    const suffix = tags.length > 0 ? ` (${tags.join(", ")})` : ""
    return `${index + 1}. ${SEVERITY_LABEL[finding.severity]}: ${oneLine(finding.title)}${suffix}`
  })
  return ["Para tratar primeiro:", ...lines].join("\n")
}

export function toSummaryText(input: SummaryTextInput): string {
  const { projectName, staleDays, findings } = input
  const name = oneLine(projectName)
  const summary = summarize(findings)

  if (summary.total === 0) {
    return `O projeto ${name} ainda não tem achados registrados.`
  }

  const paragraphs = [overviewParagraph(name, summary.total, summary.open)]

  if (summary.open > 0) {
    paragraphs.push(
      openBySeverityParagraph(findings),
      attentionParagraph(summary.overdue, summary.stale, staleDays),
      prioritiesParagraph(findings),
    )
  } else {
    paragraphs.push(
      "Não há achados abertos: todos já foram corrigidos, verificados, aceitos como risco ou marcados como falso positivo.",
    )
  }

  const owasp = topOwasp(findings)
  if (owasp.length > 0) {
    const list = owasp.map(([code, count]) => `${code} (${count})`).join(", ")
    paragraphs.push(`Categorias OWASP mais frequentes: ${list}.`)
  }

  return paragraphs.join("\n\n")
}
