import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import {
  bodyOf,
  cleanupTestUsers,
  createUser,
  sessionKey,
  startServer,
  TEST_PASSWORD,
  TestClient,
  uniqueEmail,
  type ApiResponse,
  type TestServer,
} from "../../test/helpers.js"

let server: TestServer

// Cliente novo, já com o token CSRF anônimo (o que o front faz ao abrir).
async function newClient(): Promise<TestClient> {
  const client: TestClient = new TestClient(server.baseUrl)
  await client.refreshCsrf()
  return client
}

function postLogin(
  client: TestClient,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<ApiResponse> {
  return client.request("POST", "/auth/login", {
    body: { email, password },
    csrf: true,
  })
}

// Faz login e já busca o token novo, porque o token muda com a sessão.
async function loginAs(client: TestClient, email: string): Promise<void> {
  const response: ApiResponse = await postLogin(client, email)
  expect(response.status).toBe(200)
  await client.refreshCsrf()
}

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

describe("POST /auth/register", (): void => {
  it("cadastra com 201, sem devolver a senha, e guarda só o hash", async (): Promise<void> => {
    const client: TestClient = await newClient()
    const email: string = uniqueEmail("cadastro")

    const response: ApiResponse = await client.request(
      "POST",
      "/auth/register",
      {
        body: { fullname: "Maria Souza", email, password: TEST_PASSWORD },
        csrf: true,
      },
    )

    expect(response.status).toBe(201)
    expect(bodyOf(response)).toEqual({
      id: expect.any(String),
      email,
      fullname: "Maria Souza",
      role: "ANALYST",
    })

    const saved = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(saved.password).not.toBe(TEST_PASSWORD)
    expect(saved.password).toMatch(/^\$2[aby]\$12\$/)
  })

  it("normaliza o e-mail (espaços e maiúsculas)", async (): Promise<void> => {
    const client: TestClient = await newClient()
    const email: string = uniqueEmail("normaliza")

    const response: ApiResponse = await client.request(
      "POST",
      "/auth/register",
      {
        body: {
          fullname: "  João Lima  ",
          email: `  ${email.toUpperCase()}  `,
          password: TEST_PASSWORD,
        },
        csrf: true,
      },
    )

    expect(response.status).toBe(201)
    expect(bodyOf(response)["email"]).toBe(email)
    expect(bodyOf(response)["fullname"]).toBe("João Lima")
  })

  it("e-mail já cadastrado dá 409", async (): Promise<void> => {
    const existing = await createUser()
    const client: TestClient = await newClient()

    const response: ApiResponse = await client.request(
      "POST",
      "/auth/register",
      {
        body: {
          fullname: "Outra Pessoa",
          email: existing.email,
          password: TEST_PASSWORD,
        },
        csrf: true,
      },
    )

    expect(response.status).toBe(409)
    expect(bodyOf(response)["error"]).toBe("E-mail já cadastrado")
  })

  it("dados inválidos dão 400 com o campo de cada erro", async (): Promise<void> => {
    const client: TestClient = await newClient()

    const response: ApiResponse = await client.request(
      "POST",
      "/auth/register",
      {
        body: { fullname: "A", email: "nao-e-email", password: "123" },
        csrf: true,
      },
    )

    expect(response.status).toBe(400)
    expect(bodyOf(response)["error"]).toBe("Dados inválidos")
    expect(bodyOf(response)["details"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "fullname" }),
        expect.objectContaining({ field: "email" }),
        expect.objectContaining({ field: "password" }),
      ]),
    )
  })
})

describe("POST /auth/login", (): void => {
  it("login correto dá 200 e abre uma sessão guardada no Redis", async (): Promise<void> => {
    const user = await createUser({ fullname: "Ana Lima" })
    const client: TestClient = await newClient()

    const response: ApiResponse = await postLogin(client, user.email)

    expect(response.status).toBe(200)
    expect(bodyOf(response)).toEqual({
      id: user.id,
      email: user.email,
      fullname: "Ana Lima",
      role: "ANALYST",
    })

    const sessionId: string | null = client.sessionId()
    expect(sessionId).not.toBeNull()
    const stored: string | null = await redis.get(sessionKey(sessionId ?? ""))
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ userId: user.id })
  })

  it("o cookie de sessão é HttpOnly e SameSite=Lax", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = await newClient()

    const response: ApiResponse = await postLogin(client, user.email)

    const sessionCookie: string | undefined = response.headers
      .getSetCookie()
      .find((line: string): boolean => line.startsWith("sid="))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
    expect(sessionCookie).toMatch(/Path=\//i)
  })

  it("senha errada e e-mail inexistente dão a mesma resposta 401", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = await newClient()

    const wrongPassword: ApiResponse = await postLogin(
      client,
      user.email,
      "senha-errada-123",
    )
    const unknownEmail: ApiResponse = await postLogin(
      client,
      uniqueEmail("fantasma"),
    )

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(bodyOf(wrongPassword)).toEqual({
      error: "E-mail ou senha inválidos",
    })
    // Mesma mensagem nos dois casos: não revela se o e-mail existe.
    expect(bodyOf(unknownEmail)).toEqual(bodyOf(wrongPassword))
    expect(client.sessionId()).toBeNull()
  })

  it("dados inválidos dão 400", async (): Promise<void> => {
    const client: TestClient = await newClient()

    const response: ApiResponse = await client.request("POST", "/auth/login", {
      body: { email: "nao-e-email", password: "" },
      csrf: true,
    })

    expect(response.status).toBe(400)
  })

  it("um novo login troca o id da sessão e apaga a antiga", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = await newClient()

    await loginAs(client, user.email)
    const firstSession: string = client.sessionId() ?? ""

    await loginAs(client, user.email)
    const secondSession: string = client.sessionId() ?? ""

    expect(firstSession).not.toBe("")
    expect(secondSession).not.toBe(firstSession)
    expect(await redis.get(sessionKey(firstSession))).toBeNull()
    expect(await redis.get(sessionKey(secondSession))).not.toBeNull()
  })
})

describe("GET /auth/me", (): void => {
  it("sem login dá 401", async (): Promise<void> => {
    const client: TestClient = await newClient()

    const response: ApiResponse = await client.request("GET", "/auth/me")

    expect(response.status).toBe(401)
    expect(bodyOf(response)).toEqual({ error: "Não autenticado" })
  })

  it("com login devolve o usuário, sem a senha", async (): Promise<void> => {
    const user = await createUser({ role: "VIEWER" })
    const client: TestClient = await newClient()
    await loginAs(client, user.email)

    const response: ApiResponse = await client.request("GET", "/auth/me")

    expect(response.status).toBe(200)
    expect(bodyOf(response)).toEqual({
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      role: "VIEWER",
    })
    expect(bodyOf(response)).not.toHaveProperty("password")
  })

  it("cookie de sessão forjado dá 401", async (): Promise<void> => {
    const client: TestClient = await newClient()
    client.setCookie("sid", "s%3Ainventado.assinatura-falsa")

    const response: ApiResponse = await client.request("GET", "/auth/me")

    expect(response.status).toBe(401)
  })
})

describe("POST /auth/logout", (): void => {
  it("encerra a sessão: 204, cookie removido e sessão apagada do Redis", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = await newClient()
    await loginAs(client, user.email)
    const sessionId: string = client.sessionId() ?? ""

    const response: ApiResponse = await client.request("POST", "/auth/logout", {
      csrf: true,
    })

    expect(response.status).toBe(204)
    expect(client.sessionId()).toBeNull()
    expect(await redis.get(sessionKey(sessionId))).toBeNull()

    // Um atacante com o cookie antigo também não entra mais.
    const replay: TestClient = new TestClient(server.baseUrl)
    replay.setCookie("sid", `s%3A${sessionId}.assinatura-antiga`)
    const afterLogout: ApiResponse = await replay.request("GET", "/auth/me")
    expect(afterLogout.status).toBe(401)
  })
})

describe("proteção CSRF", (): void => {
  it("POST sem token dá 403", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = new TestClient(server.baseUrl)

    const response: ApiResponse = await client.request("POST", "/auth/login", {
      body: { email: user.email, password: TEST_PASSWORD },
    })

    expect(response.status).toBe(403)
    expect(bodyOf(response)).toEqual({
      error: "Token CSRF inválido ou ausente",
    })
    expect(client.sessionId()).toBeNull()
  })

  it("POST com token inventado dá 403", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = await newClient()

    const response: ApiResponse = await client.request("POST", "/auth/login", {
      body: { email: user.email, password: TEST_PASSWORD },
      csrf: "token-inventado",
    })

    expect(response.status).toBe(403)
  })

  it("o token de outro navegador não vale", async (): Promise<void> => {
    const user = await createUser()
    const attacker: TestClient = await newClient()
    const victim: TestClient = await newClient()
    const attackerToken: string = await attacker.refreshCsrf()

    // A vítima tem o próprio cookie CSRF; o token do atacante não casa com ele.
    const response: ApiResponse = await victim.request("POST", "/auth/login", {
      body: { email: user.email, password: TEST_PASSWORD },
      csrf: attackerToken,
    })

    expect(response.status).toBe(403)
  })

  it("o token de antes do login deixa de valer depois dele", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = await newClient()
    const anonymousToken: string = await client.refreshCsrf()

    expect(await postLogin(client, user.email)).toMatchObject({ status: 200 })

    // Com o token antigo, o logout é recusado e a sessão continua aberta.
    const stale: ApiResponse = await client.request("POST", "/auth/logout", {
      csrf: anonymousToken,
    })
    expect(stale.status).toBe(403)
    expect((await client.request("GET", "/auth/me")).status).toBe(200)

    // Com o token novo, funciona.
    await client.refreshCsrf()
    const fresh: ApiResponse = await client.request("POST", "/auth/logout", {
      csrf: true,
    })
    expect(fresh.status).toBe(204)
  })

  it("requisições de leitura não exigem token", async (): Promise<void> => {
    const client: TestClient = new TestClient(server.baseUrl)

    const response: ApiResponse = await client.request("GET", "/health")

    expect(response.status).toBe(200)
  })
})
