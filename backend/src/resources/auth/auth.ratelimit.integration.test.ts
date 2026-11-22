import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import {
  bodyOf,
  cleanupTestUsers,
  createUser,
  startServer,
  TEST_PASSWORD,
  TestClient,
  uniqueEmail,
  type ApiResponse,
  type TestServer,
} from "../../test/helpers.js"

const MENSAGEM = "Muitas tentativas. Tente novamente mais tarde."

// Este arquivo é separado dos outros de propósito: o limite de tentativas
// guarda a contagem na memória do processo, por IP. Cada arquivo de teste
// tem o seu próprio contador, então aqui podemos esgotá-lo sem atrapalhar.
let server: TestServer

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

describe("limite de tentativas de login (10 falhas por 15 minutos)", (): void => {
  it("logins que dão certo não entram na conta", async (): Promise<void> => {
    const user = await createUser()

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const client: TestClient = new TestClient(server.baseUrl)
      await client.refreshCsrf()
      const response: ApiResponse = await client.request(
        "POST",
        "/auth/login",
        { body: { email: user.email, password: TEST_PASSWORD }, csrf: true },
      )
      expect(response.status).toBe(200)
    }
  })

  it("depois de 10 falhas, a 11ª tentativa dá 429, até com a senha certa", async (): Promise<void> => {
    const user = await createUser()
    const client: TestClient = new TestClient(server.baseUrl)
    await client.refreshCsrf()

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response: ApiResponse = await client.request(
        "POST",
        "/auth/login",
        {
          body: { email: user.email, password: "senha-errada-123" },
          csrf: true,
        },
      )
      expect(response.status).toBe(401)
    }

    const blocked: ApiResponse = await client.request("POST", "/auth/login", {
      body: { email: user.email, password: TEST_PASSWORD },
      csrf: true,
    })

    expect(blocked.status).toBe(429)
    expect(bodyOf(blocked)).toEqual({ error: MENSAGEM })
    expect(client.sessionId()).toBeNull()
    expect(blocked.headers.get("ratelimit")).not.toBeNull()
  })
})

describe("limite de cadastros (10 por hora)", (): void => {
  it("o 11º cadastro dá 429", async (): Promise<void> => {
    const client: TestClient = new TestClient(server.baseUrl)
    await client.refreshCsrf()

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response: ApiResponse = await client.request(
        "POST",
        "/auth/register",
        {
          body: {
            fullname: "Pessoa de Teste",
            email: uniqueEmail("limite"),
            password: TEST_PASSWORD,
          },
          csrf: true,
        },
      )
      expect(response.status).toBe(201)
    }

    const blocked: ApiResponse = await client.request(
      "POST",
      "/auth/register",
      {
        body: {
          fullname: "Pessoa de Teste",
          email: uniqueEmail("limite"),
          password: TEST_PASSWORD,
        },
        csrf: true,
      },
    )

    expect(blocked.status).toBe(429)
    expect(bodyOf(blocked)).toEqual({ error: MENSAGEM })
  })
})
