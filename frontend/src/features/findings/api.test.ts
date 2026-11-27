import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetCsrfToken } from "@/lib/api"

import {
  createFinding,
  deleteFinding,
  listDuplicates,
  listFindings,
  updateFinding,
} from "./api"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const finding = {
  id: "f1",
  title: "SQL Injection no login",
  description: "O campo de e-mail aceita aspas e quebra a consulta.",
  severity: "CRITICAL",
  status: "OPEN",
  remediation: null,
  owaspCategory: "A03:2021",
  cwe: "CWE-89",
  cve: null,
  dueDate: "2026-12-01T00:00:00.000Z",
  projectId: "p1",
  assetId: "a1",
  reporterId: "1",
  assigneeId: "2",
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
  asset: { id: "a1", name: "Portal web", type: "WEB" },
  assignee: { id: "2", fullname: "Bruno Tavares" },
  reporter: { id: "1", fullname: "Ana Ribeiro" },
}

const body = {
  title: finding.title,
  description: finding.description,
  severity: "CRITICAL" as const,
  remediation: null,
  owaspCategory: "A03:2021",
  cwe: "CWE-89",
  cve: null,
  dueDate: "2026-12-01",
  assetId: "a1",
  assigneeId: "2",
}

// Nas escritas, a primeira chamada busca o token CSRF e a segunda é a de verdade.
function mockWrite(response: Response) {
  fetchMock
    .mockResolvedValueOnce(json({ csrfToken: "tok" }))
    .mockResolvedValueOnce(response)
}

function writeCall() {
  const [url, init] = fetchMock.mock.calls[1] ?? []

  return {
    path: new URL(String(url)).pathname,
    method: init?.method,
    csrf: new Headers(init?.headers).get("X-CSRF-Token"),
    body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
  }
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.test")
  vi.stubGlobal("fetch", fetchMock)
  resetCsrfToken()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("findings api", () => {
  it("listFindings usa o projeto na URL e manda página e tamanho", async () => {
    const page = {
      data: [finding],
      meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    }
    fetchMock.mockResolvedValueOnce(json(page))

    await expect(
      listFindings("p1", { page: 2, pageSize: 10 }),
    ).resolves.toEqual(page)

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe("/projects/p1/findings")
    expect(url.searchParams.get("page")).toBe("2")
    expect(url.searchParams.get("pageSize")).toBe("10")
  })

  it("listFindings manda todos os filtros que o back aceita", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], meta: {} }))

    await listFindings("p1", {
      severity: "HIGH",
      status: "IN_PROGRESS",
      assigneeId: "u2",
      assetId: "a1",
      search: "sql",
      overdue: true,
      staleDays: 30,
    })

    const { searchParams } = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(searchParams.get("severity")).toBe("HIGH")
    expect(searchParams.get("status")).toBe("IN_PROGRESS")
    expect(searchParams.get("assigneeId")).toBe("u2")
    expect(searchParams.get("assetId")).toBe("a1")
    expect(searchParams.get("search")).toBe("sql")
    expect(searchParams.get("overdue")).toBe("true")
    expect(searchParams.get("staleDays")).toBe("30")
  })

  it("listFindings omite o que está vazio", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], meta: {} }))

    await listFindings("p1", {
      page: 1,
      search: "",
      severity: undefined,
      overdue: undefined,
    })

    const { searchParams } = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect([...searchParams.keys()]).toEqual(["page"])
  })

  it("createFinding faz POST com CSRF e devolve os parecidos", async () => {
    mockWrite(json({ ...finding, possibleDuplicates: [] }, 201))

    await expect(createFinding("p1", body)).resolves.toEqual({
      ...finding,
      possibleDuplicates: [],
    })
    expect(writeCall()).toEqual({
      path: "/projects/p1/findings",
      method: "POST",
      csrf: "tok",
      body,
    })
  })

  it("updateFinding faz PATCH no achado", async () => {
    mockWrite(json(finding))

    await updateFinding("p1", "f1", body)

    expect(writeCall()).toEqual({
      path: "/projects/p1/findings/f1",
      method: "PATCH",
      csrf: "tok",
      body,
    })
  })

  it("deleteFinding faz DELETE e aceita o 204", async () => {
    mockWrite(new Response(null, { status: 204 }))

    await expect(deleteFinding("p1", "f1")).resolves.toBeUndefined()
    expect(writeCall()).toMatchObject({
      path: "/projects/p1/findings/f1",
      method: "DELETE",
      csrf: "tok",
    })
  })

  it("listDuplicates manda só o que foi informado", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [] }))

    await listDuplicates("p1", { title: "SQL no login", assetId: undefined })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe("/projects/p1/findings/duplicates")
    expect([...url.searchParams.keys()]).toEqual(["title"])
  })
})
