export class AppError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = "AppError"
    this.status = status
    this.code = code
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  console.error(error)
  return Response.json(
    { error: "服务器内部错误", code: "INTERNAL" },
    { status: 500 },
  )
}
