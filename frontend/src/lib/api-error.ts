export type ErrorDetail = { field: string; message: string }

// Erro devolvido pela API (ou falha de conexão, com status 0).
export class ApiError extends Error {
  readonly status: number
  readonly details: ErrorDetail[] | undefined

  constructor(status: number, message: string, details?: ErrorDetail[]) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}
