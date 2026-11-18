export interface ErrorDetail {
  field: string
  message: string
}

export class AppError extends Error {
  readonly statusCode: number
  readonly details: ErrorDetail[] | undefined

  constructor(statusCode: number, message: string, details?: ErrorDetail[]) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
    this.details = details
  }
}
