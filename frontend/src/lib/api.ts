import { ApiError, type ErrorDetail } from "@/lib/api-error"

const CSRF_HEADER = "X-CSRF-Token"
const CSRF_ERROR_MESSAGE = "Token CSRF inválido ou ausente"
const UNEXPECTED_ERROR_MESSAGE = "Erro inesperado do servidor"

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
type QueryValue = string | number | boolean | null | undefined

export type RequestOptions = {
  method?: Method
  // Objeto vira JSON; FormData (upload) vai como está.
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

function getApiUrl(): string {
  const url: unknown = import.meta.env.VITE_API_URL

  if (typeof url !== "string" || url === "") {
    throw new Error(
      "VITE_API_URL não está definida. Copie o .env.example para .env.",
    )
  }

  return url.replace(/\/+$/, "")
}

// Também serve para links de download (relatório, evidência): o navegador
// manda o cookie de sessão sozinho nos GET.
export function apiUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${getApiUrl()}${path}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

function isErrorDetails(value: unknown): value is ErrorDetail[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "field" in item &&
        typeof item.field === "string" &&
        "message" in item &&
        typeof item.message === "string",
    )
  )
}

function toApiError(status: number, data: unknown): ApiError {
  if (typeof data === "object" && data !== null) {
    const error = "error" in data ? data.error : undefined
    const details = "details" in data ? data.details : undefined

    return new ApiError(
      status,
      typeof error === "string" ? error : UNEXPECTED_ERROR_MESSAGE,
      isErrorDetails(details) ? details : undefined,
    )
  }

  return new ApiError(status, UNEXPECTED_ERROR_MESSAGE)
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T

  const isJson =
    response.headers.get("content-type")?.includes("application/json") ?? false
  const data: unknown = isJson ? await response.json() : null

  if (!response.ok) throw toApiError(response.status, data)

  return data as T
}

async function send(
  path: string,
  options: RequestOptions,
  csrfToken?: string,
): Promise<Response> {
  const url = apiUrl(path, options.query)
  const headers = new Headers()
  let body: BodyInit | undefined

  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.body)
  }

  if (csrfToken) headers.set(CSRF_HEADER, csrfToken)

  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      credentials: "include",
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error
    throw new ApiError(0, "Não foi possível conectar ao servidor")
  }
}

// O token CSRF é amarrado à sessão: guardamos um só e buscamos de novo
// depois do login e do logout, quando a sessão muda.
let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null

export function resetCsrfToken(): void {
  csrfToken = null
  csrfRequest = null
}

async function fetchCsrfToken(): Promise<string> {
  const data = await parseResponse<{ csrfToken?: unknown }>(
    await send("/csrf-token", {}),
  )

  if (typeof data.csrfToken !== "string") {
    throw new ApiError(500, UNEXPECTED_ERROR_MESSAGE)
  }

  return data.csrfToken
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken

  csrfRequest ??= fetchCsrfToken().finally(() => {
    csrfRequest = null
  })
  csrfToken = await csrfRequest

  return csrfToken
}

async function requestOnce<T>(
  path: string,
  options: RequestOptions,
  needsCsrf: boolean,
): Promise<T> {
  const token = needsCsrf ? await getCsrfToken() : undefined

  return parseResponse<T>(await send(path, options, token))
}

export async function api<T = void>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const needsCsrf = (options.method ?? "GET") !== "GET"

  try {
    return await requestOnce<T>(path, options, needsCsrf)
  } catch (error) {
    const csrfRejected =
      error instanceof ApiError &&
      error.status === 403 &&
      error.message === CSRF_ERROR_MESSAGE

    if (!needsCsrf || !csrfRejected) throw error

    // O token pode ter vencido junto com a sessão: renova e tenta uma vez.
    resetCsrfToken()
    return requestOnce<T>(path, options, needsCsrf)
  }
}
