import { randomUUID } from "node:crypto"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import bcrypt from "bcryptjs"
import type { Express } from "express"

import type { User } from "../generated/prisma/client.js"
import type { Role } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

export const TEST_PASSWORD = "SenhaForte123"
export const TEST_EMAIL_DOMAIN = "teste.local"

// Prefixo das sessões no Redis (o mesmo de src/middlewares/session.ts).
const SESSION_PREFIX = "vulncase:sess:"

// Custo baixo só nos testes: o login confere a senha com qualquer custo.
const TEST_PASSWORD_HASH: string = bcrypt.hashSync(TEST_PASSWORD, 4)

export interface ApiResponse {
  status: number
  headers: Headers
  body: unknown
}

export interface RequestOptions {
  body?: unknown
  // true: usa o token guardado no cliente (veja refreshCsrf).
  // texto: usa exatamente esse token. Omitido: não envia token.
  csrf?: boolean | string
}

export interface TestServer {
  baseUrl: string
  close: () => Promise<void>
}

// Cliente HTTP com "jar" de cookies, que imita o que o navegador faz.
export class TestClient {
  private readonly baseUrl: string
  private readonly cookies: Map<string, string> = new Map()
  private csrfToken: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse> {
    const headers: Record<string, string> = {}

    if (this.cookies.size > 0) {
      headers["Cookie"] = [...this.cookies]
        .map(([name, value]): string => `${name}=${value}`)
        .join("; ")
    }

    if (options.csrf === true) {
      if (this.csrfToken === null) {
        throw new Error("Chame refreshCsrf() antes de usar csrf: true")
      }
      headers["X-CSRF-Token"] = this.csrfToken
    } else if (typeof options.csrf === "string") {
      headers["X-CSRF-Token"] = options.csrf
    }

    const init: RequestInit = { method, headers }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
      init.body = JSON.stringify(options.body)
    }

    const response: Response = await fetch(`${this.baseUrl}${path}`, init)
    this.storeCookies(response.headers)

    const text: string = await response.text()
    let body: unknown = null
    if (text !== "") {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    return { status: response.status, headers: response.headers, body }
  }

  // Busca um token novo. Precisa ser chamado de novo depois do login e do
  // logout, porque o token é amarrado à sessão.
  async refreshCsrf(): Promise<string> {
    const response: ApiResponse = await this.request("GET", "/csrf-token")
    const token: unknown = bodyOf(response)["csrfToken"]
    if (typeof token !== "string") {
      throw new Error("A resposta de /csrf-token não trouxe o token")
    }
    this.csrfToken = token
    return token
  }

  // Id da sessão (a parte do cookie "sid" que vem antes da assinatura).
  sessionId(): string | null {
    const raw: string | undefined = this.cookies.get("sid")
    if (raw === undefined) {
      return null
    }
    const decoded: string = decodeURIComponent(raw)
    if (!decoded.startsWith("s:")) {
      return null
    }
    return decoded.slice(2).split(".")[0] ?? null
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value)
  }

  private storeCookies(headers: Headers): void {
    for (const line of headers.getSetCookie()) {
      const [pair = "", ...attributes] = line
        .split(";")
        .map((part: string): string => part.trim())
      const separator: number = pair.indexOf("=")
      if (separator === -1) {
        continue
      }

      const name: string = pair.slice(0, separator)
      const value: string = pair.slice(separator + 1)
      const expired: boolean = attributes.some((attribute: string): boolean => {
        if (/^max-age=0$/i.test(attribute)) {
          return true
        }
        return (
          /^expires=/i.test(attribute) &&
          Date.parse(attribute.slice("expires=".length)) < Date.now()
        )
      })

      if (value === "" || expired) {
        this.cookies.delete(name)
      } else {
        this.cookies.set(name, value)
      }
    }
  }
}

export function bodyOf(response: ApiResponse): Record<string, unknown> {
  if (typeof response.body !== "object" || response.body === null) {
    throw new Error(`Corpo inesperado: ${JSON.stringify(response.body)}`)
  }
  return response.body as Record<string, unknown>
}

export function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`
}

export function startServer(app: Express): Promise<TestServer> {
  return new Promise<TestServer>((resolve, reject): void => {
    const server: Server = app.listen(0, "127.0.0.1", (error?: Error): void => {
      if (error) {
        reject(error)
        return
      }
      const address: string | AddressInfo | null = server.address()
      if (address === null || typeof address === "string") {
        reject(new Error("Não foi possível descobrir a porta do servidor"))
        return
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: (): Promise<void> =>
          new Promise<void>((done, fail): void => {
            server.close((closeError?: Error): void => {
              if (closeError) {
                fail(closeError)
                return
              }
              done()
            })
          }),
      })
    })
  })
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`
}

interface UserOverrides {
  email?: string
  fullname?: string
  role?: Role
}

// Cria o usuário direto no banco (sem passar pelo /auth/register, que tem
// limite de 10 cadastros por hora). A senha é sempre TEST_PASSWORD.
export function createUser(overrides: UserOverrides = {}): Promise<User> {
  return prisma.user.create({
    data: {
      email: overrides.email ?? uniqueEmail(),
      fullname: overrides.fullname ?? "Usuário de Teste",
      password: TEST_PASSWORD_HASH,
      role: overrides.role ?? "ANALYST",
    },
  })
}

// Apaga tudo o que os testes criaram (todos os e-mails de teste terminam
// com o mesmo domínio).
export async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
  })
}
