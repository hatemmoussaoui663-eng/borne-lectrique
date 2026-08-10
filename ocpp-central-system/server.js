import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { handleAction } from './ocppHandlers.js'
import { postToLaravel } from './laravelClient.js'

try {
  process.loadEnvFile()
} catch {
  console.warn('[ocpp-central-system] no .env file found, using process env / defaults')
}

const PORT = Number(process.env.PORT ?? 8010)
const COMMAND_TIMEOUT_MS = 20_000

function chargePointIdFromUrl(url) {
  const segments = (url ?? '').split('/').filter(Boolean)
  return segments.at(-1) ?? 'unknown'
}

function log(chargePointId, message) {
  console.log(`[${new Date().toISOString()}] [${chargePointId}] ${message}`)
}

// One active WebSocket per charge point, keyed by its OCPP identity, so an
// admin action (see handleCommandRequest below) can be routed to the right
// station. A reconnect simply overwrites the previous (now dead) entry.
const connections = new Map()

// CALLs this CSMS itself initiated (RemoteStartTransaction, Reset, ...),
// keyed by the uniqueId we generated, so the matching CALLRESULT/CALLERROR
// coming back from the charge point can be routed to the HTTP request that's
// waiting on it.
const pendingCommands = new Map()

const httpServer = createServer((req, res) => handleHttpRequest(req, res).catch((error) => {
  console.error(`[ocpp-central-system] HTTP handler error: ${error.message}`)
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
  }
  res.end(JSON.stringify({ message: 'Internal error' }))
}))

async function handleHttpRequest(req, res) {
  const match = /^\/commands\/([^/]+)$/.exec(req.url ?? '')

  if (req.method !== 'POST' || !match) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Not found' }))
    return
  }

  const expectedToken = process.env.OCPP_INGEST_TOKEN ?? ''
  if (!expectedToken || req.headers['x-internal-token'] !== expectedToken) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Unauthorized' }))
    return
  }

  const chargePointId = decodeURIComponent(match[1])
  const body = await readJsonBody(req)
  const { action, payload } = body ?? {}

  if (!action) {
    res.writeHead(422, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Missing action' }))
    return
  }

  const ws = connections.get(chargePointId)
  if (!ws || ws.readyState !== ws.OPEN) {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: `${chargePointId} is not currently connected` }))
    return
  }

  try {
    const result = await sendCommand(ws, chargePointId, action, payload ?? {})
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    res.writeHead(504, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: error.message }))
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/** Sends a CSMS-initiated CALL and resolves once the matching CALLRESULT arrives (or rejects on CALLERROR/timeout). */
function sendCommand(ws, chargePointId, action, payload) {
  const uniqueId = randomUUID()

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(uniqueId)
      reject(new Error(`${action} timed out waiting for ${chargePointId} to respond`))
    }, COMMAND_TIMEOUT_MS)

    pendingCommands.set(uniqueId, { resolve, reject, timeout })
    ws.send(JSON.stringify([2, uniqueId, action, payload]))
    log(chargePointId, `-> ${action} (${uniqueId})`)
  })
}

const wss = new WebSocketServer({
  server: httpServer,
  handleProtocols: (protocols) => (protocols.has('ocpp1.6') ? 'ocpp1.6' : protocols.values().next().value ?? false),
})

wss.on('connection', (ws, request) => {
  const chargePointId = chargePointIdFromUrl(request.url)
  log(chargePointId, `connected (${request.url})`)
  connections.set(chargePointId, ws)

  ws.on('message', async (raw) => {
    let frame
    try {
      frame = JSON.parse(raw.toString())
    } catch {
      log(chargePointId, `dropped non-JSON frame: ${raw.toString().slice(0, 200)}`)
      return
    }

    const [messageType, uniqueId, actionOrErrorCode, payload] = frame

    // MessageType 3/4 (CALLRESULT/CALLERROR) are replies to a CALL *we* sent
    // via sendCommand() above — route them back to the waiting HTTP request.
    if (messageType === 3 || messageType === 4) {
      const pending = pendingCommands.get(uniqueId)
      if (!pending) {
        log(chargePointId, `ignoring unexpected reply for ${uniqueId}`)
        return
      }
      pendingCommands.delete(uniqueId)
      clearTimeout(pending.timeout)
      if (messageType === 3) {
        pending.resolve(actionOrErrorCode ?? {})
      } else {
        pending.reject(new Error(`${chargePointId} rejected the command: ${actionOrErrorCode} ${payload ?? ''}`))
      }
      return
    }

    if (messageType !== 2) {
      log(chargePointId, `ignoring frame type ${messageType}`)
      return
    }

    const action = actionOrErrorCode

    try {
      const result = await handleAction(action, payload ?? {}, { chargePointId, log: (m) => log(chargePointId, m) })
      ws.send(JSON.stringify([3, uniqueId, result]))
      log(chargePointId, `${action} -> accepted`)
    } catch (error) {
      log(chargePointId, `${action} failed: ${error.message}`)
      ws.send(JSON.stringify([4, uniqueId, 'InternalError', error.message, {}]))
    }
  })

  ws.on('error', (error) => {
    log(chargePointId, `socket error: ${error.message}`)
  })

  ws.on('close', () => {
    log(chargePointId, 'disconnected')
    if (connections.get(chargePointId) === ws) {
      connections.delete(chargePointId)
    }
    postToLaravel('/disconnect', { chargePointId }).catch((error) => {
      log(chargePointId, `disconnect ingest failed: ${error.message}`)
    })
  })
})

wss.on('error', (error) => {
  console.error(`[ocpp-central-system] server error: ${error.message}`)
})

httpServer.listen(PORT, () => {
  console.log(`[ocpp-central-system] OCPP 1.6-J central system listening on ws://0.0.0.0:${PORT} (commands: POST /commands/:chargePointId)`)
})
