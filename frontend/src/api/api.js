export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(status, data) {
    super(`HTTP ${status}`)
    this.status = status
    this.data = data   // JSON del body (incluye detail[] de FastAPI 422/409)
  }
}

export async function apiFetch(path, options = {}) {
  const { body, headers, ...rest } = options
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...rest,
  })

  let data = null
  try { data = await res.json() } catch { /* body vacío o no-JSON */ }

  if (!res.ok) throw new ApiError(res.status, data)
  return data
}
