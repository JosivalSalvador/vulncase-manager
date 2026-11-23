import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { addMember, createAsset, createProject } from "../../test/fixtures.js"
import {
  bodyOf,
  cleanupTestUsers,
  createUser,
  signIn,
  startServer,
  uniqueEmail,
  type ApiResponse,
  type DownloadResponse,
  type TestClient,
  type TestServer,
} from "../../test/helpers.js"
import { addFinding, dueDateIn } from "../../test/scenario.js"
import { startOfToday } from "../../utils/dates.js"

const PROJECT_NAME = "Relatório - Portal Web"
const EMPTY_NAME = "Relatório - sem achados"

const CSV_HEADER =
  "id,titulo,severidade,status,ativo,tipo_ativo,identificador_ativo," +
  "responsavel,relator,owasp,cwe,cve,prazo,vencido,parado,criado_em," +
  "atualizado_em,descricao,correcao_proposta"

let server: TestServer
let alice: TestClient
let projectId: string
let emptyProjectId: string

let idorId: string
let formulaId: string
let xssId: string
let forgedId: string
let headerId: string

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  const aliceUser = await createUser({
    email: uniqueEmail("alice"),
    fullname: "Alice Souza",
  })
  const brunoUser = await createUser({
    email: uniqueEmail("bruno"),
    fullname: "Bruno Lima",
  })
  alice = await signIn(server.baseUrl, aliceUser.email)

  projectId = await createProject(alice, PROJECT_NAME)
  emptyProjectId = await createProject(alice, EMPTY_NAME)
  await addMember(alice, projectId, brunoUser.email)
  const portalId: string = await createAsset(alice, projectId, "Portal web")

  // Cinco achados, um por severidade. Contas esperadas (staleDays = 30):
  //   abertos: o 1, o 2 e o 3 (o 4 está corrigido e o 5 é risco aceito)
  //   vencidos: só o 1 (o prazo do 4 também passou, mas ele está fechado)
  //   parados: só o 2 (o 3 tem 20 dias; com staleDays = 10, o 3 também)
  idorId = await addFinding(alice, projectId, {
    title: "Acesso a dados de outro usuário (IDOR)",
    severity: "CRITICAL",
    description: "Troque o id na URL e veja os dados de outra pessoa.",
    remediation: "Validar a posse do recurso no servidor.",
    owaspCategory: "A01:2021",
    cwe: "CWE-639",
    assetId: portalId,
    assigneeId: brunoUser.id,
    dueInDays: -1,
    createdDaysAgo: 5,
  })

  // Título que uma planilha leria como fórmula, e descrição com vírgula,
  // aspas e quebra de linha.
  formulaId = await addFinding(alice, projectId, {
    title: '=HYPERLINK("http://exemplo.com","clique")',
    severity: "HIGH",
    description: 'Linha um, com vírgula\nLinha "dois"',
    createdDaysAgo: 60,
  })

  // Título e descrição com marcação de HTML e de Markdown.
  xssId = await addFinding(alice, projectId, {
    title: "<script>alert(1)</script> na busca",
    severity: "MEDIUM",
    description: "Texto com *negrito* e [link](http://x).",
    owaspCategory: "A03:2021",
    cwe: "CWE-79",
    cve: "CVE-2024-12345",
    createdDaysAgo: 20,
  })

  // Título com quebra de linha, que tenta abrir um título falso no relatório.
  forgedId = await addFinding(alice, projectId, {
    title: "Falha grave\n# Título falso",
    severity: "LOW",
    dueInDays: -30,
    createdDaysAgo: 90,
    status: "FIXED",
  })

  headerId = await addFinding(alice, projectId, {
    title: "Cabeçalho X-Powered-By visível",
    severity: "INFO",
    status: "ACCEPTED_RISK",
  })
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

interface Report {
  status: number
  headers: Headers
  bytes: Buffer
  text: string
}

async function fetchReport(project: string, query: string): Promise<Report> {
  const response: DownloadResponse = await alice.download(
    `/projects/${project}/report${query}`,
  )
  return { ...response, text: response.bytes.toString("utf8") }
}

async function getJson(path: string): Promise<Record<string, unknown>> {
  const response: ApiResponse = await alice.request("GET", path)
  expect(response.status).toBe(200)
  return bodyOf(response)
}

function today(): string {
  return startOfToday().toISOString().slice(0, 10)
}

// As linhas do CSV, sem o BOM e sem a linha vazia depois do último CRLF.
function csvRows(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((row): boolean => row !== "")
}

function csvRowOf(text: string, id: string): string {
  const row: string | undefined = csvRows(text).find((candidate): boolean =>
    candidate.startsWith(`${id},`),
  )
  if (row === undefined) {
    throw new Error(`O CSV não tem a linha do achado ${id}`)
  }
  return row
}

function expectLines(lines: string[], expected: string[]): void {
  for (const line of expected) {
    expect(lines, line).toContain(line)
  }
}

describe("relatório em CSV", (): void => {
  it("baixa como arquivo, com BOM, tipo e cabeçalhos certos", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=csv")

    expect(report.status).toBe(200)
    expect(report.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(report.headers.get("content-disposition")).toBe(
      `attachment; filename=relatorio-relatorio-portal-web-${today()}.csv`,
    )
    expect(report.headers.get("cache-control")).toBe("private, no-store")

    // O BOM faz o Excel abrir os acentos certos; o CRLF é o fim de linha do CSV.
    expect([...report.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(report.text.endsWith("\r\n")).toBe(true)
  })

  it("tem a linha de títulos e uma linha por achado, do mais grave ao menos grave", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=csv")
    const rows = csvRows(report.text)

    expect(rows[0]).toBe(CSV_HEADER)
    expect(
      rows.slice(1).map((row): string | undefined => row.split(",")[0]),
    ).toEqual([idorId, formulaId, xssId, forgedId, headerId])
  })

  it("preenche ativo, responsável, relator, categorias, prazo e marcas", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=csv")
    const row = csvRowOf(report.text, idorId)

    expect(
      row.startsWith(
        `${idorId},Acesso a dados de outro usuário (IDOR),CRITICAL,OPEN,` +
          "Portal web,WEB,,Bruno Lima,Alice Souza,A01:2021,CWE-639,," +
          `${dueDateIn(-1)},sim,nao,`,
      ),
    ).toBe(true)
    expect(
      row.endsWith(
        ",Troque o id na URL e veja os dados de outra pessoa.," +
          "Validar a posse do recurso no servidor.",
      ),
    ).toBe(true)
  })

  it("neutraliza fórmula de planilha e protege vírgula, aspas e quebra de linha", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=csv")
    const row = csvRowOf(report.text, formulaId)

    // O apóstrofo na frente impede a planilha de executar o título.
    expect(
      row.startsWith(
        `${formulaId},"'=HYPERLINK(""http://exemplo.com"",""clique"")",HIGH,OPEN,`,
      ),
    ).toBe(true)
    // A descrição fica entre aspas, com as aspas duplicadas.
    expect(row).toContain('"Linha um, com vírgula\nLinha ""dois"""')
    // Sem prazo (não vence) e com 60 dias (parado).
    expect(row).toContain(",,nao,sim,")
  })

  it("usa o staleDays pedido na marca de parado", async (): Promise<void> => {
    const standard = await fetchReport(projectId, "?format=csv")
    const shorter = await fetchReport(projectId, "?format=csv&staleDays=10")

    // O achado de 20 dias e sem prazo só é "parado" com staleDays = 10.
    expect(csvRowOf(standard.text, xssId)).toContain("CVE-2024-12345,,nao,nao,")
    expect(csvRowOf(shorter.text, xssId)).toContain("CVE-2024-12345,,nao,sim,")
  })

  it("projeto sem achados traz só a linha de títulos", async (): Promise<void> => {
    const report = await fetchReport(emptyProjectId, "?format=csv")

    expect(csvRows(report.text)).toEqual([CSV_HEADER])
  })
})

describe("relatório em Markdown", (): void => {
  it("é o formato padrão e baixa como arquivo", async (): Promise<void> => {
    const report = await fetchReport(projectId, "")

    expect(report.status).toBe(200)
    expect(report.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    )
    expect(report.headers.get("content-disposition")).toBe(
      `attachment; filename=relatorio-relatorio-portal-web-${today()}.md`,
    )
    expect(report.headers.get("cache-control")).toBe("private, no-store")
    expect(report.text.startsWith("# Relatório de vulnerabilidades: ")).toBe(
      true,
    )
  })

  it("abre com o título e o resumo em números, iguais aos do dashboard", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=md")
    const lines = report.text.split("\n")

    expect(lines[0]).toBe(
      "# Relatório de vulnerabilidades: Relatório - Portal Web",
    )
    expect(lines[2]).toContain(`Gerado em ${today()}.`)
    expect(lines[2]).toContain("mais de 30 dias")
    expectLines(lines, [
      "| Achados | 5 |",
      "| Abertos | 3 |",
      "| Vencidos | 1 |",
      "| Parados (mais de 30 dias) | 1 |",
    ])

    const stats = await getJson(`/projects/${projectId}/stats`)
    expectLines(lines, [
      `| Achados | ${String(stats["total"])} |`,
      `| Abertos | ${String(stats["open"])} |`,
      `| Vencidos | ${String(stats["overdue"])} |`,
      `| Parados (mais de 30 dias) | ${String(stats["stale"])} |`,
    ])
  })

  it("conta por severidade e por status", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=md")

    expectLines(report.text.split("\n"), [
      "| Crítica | 1 |",
      "| Alta | 1 |",
      "| Média | 1 |",
      "| Baixa | 1 |",
      "| Informativa | 1 |",
      "| Aberto | 3 |",
      "| Em andamento | 0 |",
      "| Corrigido | 1 |",
      "| Verificado | 0 |",
      "| Risco aceito | 1 |",
      "| Falso positivo | 0 |",
    ])
  })

  it("agrupa os achados por severidade, do mais grave ao menos grave", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=md")
    const lines = report.text.split("\n")
    const headings: string[] = [
      "### Crítica (1)",
      "### Alta (1)",
      "### Média (1)",
      "### Baixa (1)",
      "### Informativa (1)",
    ]

    const positions: number[] = headings.map((heading): number =>
      lines.indexOf(heading),
    )
    expect(positions).not.toContain(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it("mostra o achado completo", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=md")

    expectLines(report.text.split("\n"), [
      "#### 1. Acesso a dados de outro usuário (IDOR)",
      "- **Status:** Aberto",
      "- **Ativo:** Portal web (WEB)",
      "- **Responsável:** Bruno Lima",
      "- **Relator:** Alice Souza",
      "- **OWASP:** A01:2021",
      "- **CWE:** CWE-639",
      `- **Prazo:** ${dueDateIn(-1)} (vencido)`,
      "> Troque o id na URL e veja os dados de outra pessoa.",
      "> Validar a posse do recurso no servidor.",
      // O achado parado, sem ativo, sem responsável e sem prazo.
      "- **Status:** Aberto (parado)",
      "- **Ativo:** sem ativo",
      "- **Responsável:** não atribuído",
      "- **Prazo:** sem prazo",
      "_Não informada._",
      "- **CVE:** CVE-2024-12345",
      "- **Status:** Corrigido",
      "- **Status:** Risco aceito",
    ])
  })

  it("escapa o que o usuário escreveu e não deixa um título forjar uma seção", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=md")
    const lines = report.text.split("\n")

    expectLines(lines, [
      "#### 3. \\<script\\>alert(1)\\</script\\> na busca",
      "> Texto com \\*negrito\\* e \\[link\\](http://x).",
      "#### 4. Falha grave \\# Título falso",
    ])
    // Só o título do relatório é um título de nível 1.
    expect(lines.filter((line): boolean => line.startsWith("# "))).toHaveLength(
      1,
    )
    expect(lines).not.toContain("# Título falso")
  })

  it("usa o staleDays pedido", async (): Promise<void> => {
    const report = await fetchReport(projectId, "?format=md&staleDays=10")
    const lines = report.text.split("\n")

    expect(lines[2]).toContain("mais de 10 dias")
    expect(lines).toContain("| Parados (mais de 10 dias) | 2 |")
  })

  it("projeto sem achados diz isso e mantém os números zerados", async (): Promise<void> => {
    const report = await fetchReport(emptyProjectId, "?format=md")
    const lines = report.text.split("\n")

    expect(lines).toContain("Nenhum achado registrado neste projeto.")
    expect(lines).toContain("| Achados | 0 |")
  })
})

describe("parâmetros do relatório", (): void => {
  it("recusa formato desconhecido e staleDays fora do limite", async (): Promise<void> => {
    const queries: string[] = [
      "?format=pdf",
      "?format=",
      "?staleDays=0",
      "?staleDays=366",
      "?staleDays=abc",
    ]

    for (const query of queries) {
      const response: ApiResponse = await alice.request(
        "GET",
        `/projects/${projectId}/report${query}`,
      )
      expect(response.status, query).toBe(400)
    }
  })
})
