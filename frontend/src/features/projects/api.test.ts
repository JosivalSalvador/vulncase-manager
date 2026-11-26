import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetCsrfToken } from "@/lib/api"

import { createProject, deleteProject, listProjects } from "./api"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const project = {
  id: "p1",
  name: "Portal RH",
  description: null,
  ownerId: "u1",
  createdAt: "2026-11-26T00:00:00.000Z",
  updatedAt: "2026-11-26T00:00:00.000Z",
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

describe("projects api", () => {
  it("listProjects manda página, tamanho e busca na URL", async () => {
    const page = {
      data: [project],
      meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    }
    fetchMock.mockResolvedValueOnce(json(page))

    await expect(
      listProjects({ page: 2, pageSize: 10, search: "portal rh" }),
    ).resolves.toEqual(page)

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe("/projects")
    expect(url.searchParams.get("page")).toBe("2")
    expect(url.searchParams.get("pageSize")).toBe("10")
    expect(url.searchParams.get("search")).toBe("portal rh")
  })

  it("listProjects omite a busca vazia", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    )

    await listProjects({ page: 1, search: "" })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.has("search")).toBe(false)
  })

  it("createProject envia o corpo em JSON com POST", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(json(project, 201))

    await expect(
      createProject({ name: "Portal RH", description: null }),
    ).resolves.toEqual(project)

    const init = fetchMock.mock.calls[1]?.[1]
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe(
      JSON.stringify({ name: "Portal RH", description: null }),
    )
  })

  it("deleteProject aceita a resposta 204 sem corpo", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteProject("p1")).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE")
  })
})
