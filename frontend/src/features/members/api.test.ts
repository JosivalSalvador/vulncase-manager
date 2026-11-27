import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetCsrfToken } from "@/lib/api"

import { addMember, listMembers, removeMember } from "./api"

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const member = {
  userId: "u1",
  fullname: "Bruno Tavares",
  email: "bruno@vulncase.test",
  role: "ANALYST",
  isOwner: false,
  joinedAt: "2026-11-26T00:00:00.000Z",
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

describe("members api", () => {
  it("listMembers usa o projeto na URL e manda página e tamanho", async () => {
    const page = {
      data: [member],
      meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    }
    fetchMock.mockResolvedValueOnce(json(page))

    await expect(listMembers("p1", { page: 2, pageSize: 10 })).resolves.toEqual(
      page,
    )

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe("/projects/p1/members")
    expect(url.searchParams.get("page")).toBe("2")
    expect(url.searchParams.get("pageSize")).toBe("10")
  })

  it("addMember envia o e-mail em JSON com POST", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(json(member, 201))

    await expect(
      addMember("p1", { email: "bruno@vulncase.test" }),
    ).resolves.toEqual(member)

    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe(
      "/projects/p1/members",
    )
    const init = fetchMock.mock.calls[1]?.[1]
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe(JSON.stringify({ email: "bruno@vulncase.test" }))
  })

  it("removeMember usa DELETE no usuário do projeto e aceita o 204", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: "t" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(removeMember("p1", "u1")).resolves.toBeUndefined()

    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe(
      "/projects/p1/members/u1",
    )
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE")
  })
})
