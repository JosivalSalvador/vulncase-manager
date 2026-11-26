import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetCsrfToken } from "@/lib/api"

import { createAsset, deleteAsset, listAssets, updateAsset } from "./api"
import type { AssetBody } from "./types"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const asset = {
  id: "a1",
  name: "Portal web",
  type: "WEB",
  identifier: "https://portal.exemplo.edu.br",
  projectId: "p1",
  createdAt: "2026-11-26T00:00:00.000Z",
  updatedAt: "2026-11-26T00:00:00.000Z",
}

const body: AssetBody = {
  name: "Portal web",
  type: "WEB",
  identifier: null,
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

describe("assets api", () => {
  it("listAssets usa o projeto na URL e manda página, tipo e busca", async () => {
    const page = {
      data: [asset],
      meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    }
    fetchMock.mockResolvedValueOnce(json(page))

    await expect(
      listAssets("p1", {
        page: 2,
        pageSize: 10,
        type: "WEB",
        search: "portal",
      }),
    ).resolves.toEqual(page)

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe("/projects/p1/assets")
    expect(url.searchParams.get("page")).toBe("2")
    expect(url.searchParams.get("pageSize")).toBe("10")
    expect(url.searchParams.get("type")).toBe("WEB")
    expect(url.searchParams.get("search")).toBe("portal")
  })

  it("listAssets omite tipo e busca quando não há filtro", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    )

    await listAssets("p1", { page: 1, search: "" })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.has("type")).toBe(false)
    expect(url.searchParams.has("search")).toBe(false)
  })

  it("createAsset envia o corpo em JSON com POST", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(json(asset, 201))

    await expect(createAsset("p1", body)).resolves.toEqual(asset)

    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe(
      "/projects/p1/assets",
    )
    const init = fetchMock.mock.calls[1]?.[1]
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe(JSON.stringify(body))
  })

  it("updateAsset usa PATCH no ativo do projeto", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(json(asset))

    await updateAsset("p1", "a1", body)

    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe(
      "/projects/p1/assets/a1",
    )
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH")
  })

  it("deleteAsset aceita a resposta 204 sem corpo", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteAsset("p1", "a1")).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE")
  })
})
