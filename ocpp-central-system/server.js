import { WebSocketServer } from 'ws'
import { handleAction } from './ocppHandlers.js'
import { postToLaravel } from './laravelClient.js'

try {
  process.loadEnvFile()
} catch {
  console.warn('[ocpp-central-system] no .env file found, using process env / defaults')
}

const PORT = Number(process.env.PORT ?? 8010)

function chargePointIdFromUrl(url) {
  const segments = (url ?? '').split('/').filter(Boolean)
  return segments.at(-1) ?? 'unknown'
}

function log(chargePointId, message) {
  console.log(`[${new Date().toISOString()}] [${chargePointId}] ${message}`)
}

const wss = new WebSocketServer({
  port: PORT,
  handleProtocols: (protocols) => (protocols.has('ocpp1.6') ? 'ocpp1.6' : protocols.values().next().value ?? false),
})

wss.on('connection', (ws, request) => {
  const chargePointId = chargePointIdFromUrl(request.url)
  log(chargePointId, `connected (${request.url})`)

  ws.on('message', async (raw) => {
    let frame
    try {
      frame = JSON.parse(raw.toString())
    } catch {
      log(chargePointId, `dropped non-JSON frame: ${raw.toString().slice(0, 200)}`)
      return
    }

    const [messageType, uniqueId, actionOrErrorCode, payload] = frame

    // MessageType 2 = CALL (charge point → CSMS). This minimal CSMS never
    // initiates its own CALLs, so 3 (CALLRESULT) / 4 (CALLERROR) frames from
    // the charge point are just replies we don't expect and can ignore.
    if (messageType !== 2) {
      log(chargePointId, `ignoring non-CALL frame type ${messageType}`)
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
    postToLaravel('/disconnect', { chargePointId }).catch((error) => {
      log(chargePointId, `disconnect ingest failed: ${error.message}`)
    })
  })
})

wss.on('error', (error) => {
  console.error(`[ocpp-central-system] server error: ${error.message}`)
})

console.log(`[ocpp-central-system] OCPP 1.6-J central system listening on ws://0.0.0.0:${PORT}`)
