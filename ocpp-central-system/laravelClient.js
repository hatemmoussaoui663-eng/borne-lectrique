/**
 * POSTs to one of the Laravel `/api/internal/ocpp/*` endpoints and returns the
 * parsed JSON body. Throws on network failure or a non-2xx response so callers
 * can decide whether the OCPP action should still be acknowledged.
 *
 * Reads `process.env` at call time, not at module-eval time: this module is
 * statically imported by `server.js` before its `process.loadEnvFile()` call
 * runs, so caching the env vars into module-level consts would freeze them at
 * their pre-`.env`-load (empty) values.
 */
export async function postToLaravel(path, body) {
  const baseUrl = process.env.LARAVEL_BASE_URL ?? 'http://127.0.0.1:5000'
  const token = process.env.OCPP_INGEST_TOKEN ?? ''

  const response = await fetch(`${baseUrl}/api/internal/ocpp${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': token,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Laravel ${path} responded ${response.status}: ${text}`)
  }

  return response.json()
}
