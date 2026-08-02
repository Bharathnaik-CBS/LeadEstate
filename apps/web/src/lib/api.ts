import { getToken, invalidateAuthSession } from "@/lib/auth"

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000"
).replace(/\/+$/, "")

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  token?: string | null
}

type ApiErrorResponse = {
  message?: string | string[]
  error?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const requestPath = path.startsWith("/") ? path : `/${path}`
  const requestToken = options.token
  const headers = new Headers(options.headers)

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  if (requestToken) {
    headers.set("Authorization", `Bearer ${requestToken}`)
  }

  let response: Response

  try {
    response = await fetch(`${API_URL}${requestPath}`, {
      ...options,
      headers,
      body:
        options.body === undefined || options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      `API unavailable at ${API_URL}. Start the backend or check NEXT_PUBLIC_API_URL.`,
      0
    )
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    if (
      requestToken &&
      isUnauthorized(response.status) &&
      getToken() === requestToken
    ) {
      invalidateAuthSession()
    }

    throw new ApiError(
      getErrorMessage(data, response.statusText),
      response.status
    )
  }

  return data as T
}

export function getFriendlyApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback
  }

  return error instanceof Error ? error.message : fallback
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type")

  if (!contentType?.includes("application/json")) {
    return null
  }

  try {
    return response.json()
  } catch {
    return null
  }
}

function getErrorMessage(data: unknown, fallback = "Something went wrong") {
  const errorData = data as ApiErrorResponse | null
  const message = errorData?.message

  if (Array.isArray(message)) {
    return message.join(", ")
  }

  return message ?? errorData?.error ?? fallback
}

function isUnauthorized(status: number) {
  return status === 401
}
