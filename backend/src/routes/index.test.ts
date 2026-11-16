import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import express from "express"
import type { Express } from "express"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { notFound } from "../middlewares/notFound.js"
import { routes } from "./index.js"

function listen(app: Express): Promise<Server> {
  return new Promise<Server>((resolve, reject): void => {
    const server: Server = app.listen(0, "127.0.0.1", (error?: Error): void => {
      if (error) {
        reject(error)
        return
      }
      resolve(server)
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    server.close((error?: Error): void => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

describe("rotas base", (): void => {
  let server: Server
  let baseUrl: string

  beforeAll(async (): Promise<void> => {
    const app: Express = express()
    app.use(routes)
    app.use(notFound)

    server = await listen(app)

    const address: string | AddressInfo | null = server.address()
    if (address === null || typeof address === "string") {
      throw new Error("Não foi possível descobrir a porta do servidor de teste")
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async (): Promise<void> => {
    await close(server)
  })

  it("GET /health responde 200 com status ok", async (): Promise<void> => {
    const response: Response = await fetch(`${baseUrl}/health`)
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: "ok" })
  })

  it("rota inexistente responde 404 em JSON", async (): Promise<void> => {
    const response: Response = await fetch(`${baseUrl}/nao-existe`)
    const body: unknown = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: "Rota não encontrada" })
  })
})
