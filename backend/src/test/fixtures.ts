import { bodyOf, type ApiResponse, type TestClient } from "./helpers.js"

// Lê o "id" da resposta de criação. Se a preparação do cenário falhar, o erro
// aparece aqui, claro, em vez de virar um teste quebrado mais adiante.
function createdId(response: ApiResponse, what: string): string {
  const id: unknown = response.status === 201 ? bodyOf(response)["id"] : null
  if (typeof id !== "string") {
    throw new Error(
      `Não consegui criar ${what} no teste: ${response.status} ` +
        JSON.stringify(response.body),
    )
  }
  return id
}

export interface Call {
  method: string
  path: string
  body?: unknown
}

// Faz uma chamada com o token CSRF do cliente (as leituras o ignoram).
export function send(client: TestClient, call: Call): Promise<ApiResponse> {
  return client.request(call.method, call.path, {
    csrf: true,
    ...(call.body !== undefined ? { body: call.body } : {}),
  })
}

// A mensagem de erro da resposta ({ "error": "..." }).
export function errorOf(response: ApiResponse): unknown {
  return bodyOf(response)["error"]
}

// As funções abaixo passam pela API de verdade (com sessão e CSRF), então o
// dono, os membros e o histórico nascem do mesmo jeito que na aplicação.

export async function createProject(
  client: TestClient,
  name = "Projeto de teste",
): Promise<string> {
  const response: ApiResponse = await client.request("POST", "/projects", {
    body: { name },
    csrf: true,
  })
  return createdId(response, "o projeto")
}

export async function createAsset(
  client: TestClient,
  projectId: string,
  name = "Portal web",
): Promise<string> {
  const response: ApiResponse = await client.request(
    "POST",
    `/projects/${projectId}/assets`,
    { body: { name, type: "WEB" }, csrf: true },
  )
  return createdId(response, "o ativo")
}

interface FindingOptions {
  title?: string
  assetId?: string
}

export async function createFinding(
  client: TestClient,
  projectId: string,
  options: FindingOptions = {},
): Promise<string> {
  const response: ApiResponse = await client.request(
    "POST",
    `/projects/${projectId}/findings`,
    {
      body: {
        title: options.title ?? "XSS refletido na busca",
        description: "O parâmetro q é exibido na página sem nenhum escape.",
        severity: "HIGH",
        ...(options.assetId ? { assetId: options.assetId } : {}),
      },
      csrf: true,
    },
  )
  return createdId(response, "o achado")
}

export async function addMember(
  client: TestClient,
  projectId: string,
  email: string,
): Promise<void> {
  const response: ApiResponse = await client.request(
    "POST",
    `/projects/${projectId}/members`,
    { body: { email }, csrf: true },
  )
  if (response.status !== 201) {
    throw new Error(
      `Não consegui adicionar ${email} ao projeto no teste: ` +
        `${response.status} ${JSON.stringify(response.body)}`,
    )
  }
}
