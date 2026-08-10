import { postToLaravel } from './laravelClient.js'

function extractEnergyWh(meterValue) {
  for (const entry of meterValue ?? []) {
    for (const sample of entry.sampledValue ?? []) {
      const measurand = sample.measurand ?? 'Energy.Active.Import.Register'
      if (measurand !== 'Energy.Active.Import.Register') continue

      const value = Number(sample.value)
      if (Number.isNaN(value)) continue

      return sample.unit === 'kWh' ? value * 1000 : value
    }
  }

  return undefined
}

async function bootNotification(payload, { chargePointId, log }) {
  try {
    await postToLaravel('/boot-notification', {
      chargePointId,
      vendor: payload.chargePointVendor,
      model: payload.chargePointModel,
      firmwareVersion: payload.firmwareVersion,
    })
  } catch (error) {
    log(`boot-notification ingest failed: ${error.message}`)
  }

  return {
    status: 'Accepted',
    currentTime: new Date().toISOString(),
    interval: 60,
  }
}

async function heartbeat(_payload, { chargePointId, log }) {
  try {
    await postToLaravel('/heartbeat', { chargePointId })
  } catch (error) {
    log(`heartbeat ingest failed: ${error.message}`)
  }

  return { currentTime: new Date().toISOString() }
}

async function statusNotification(payload, { chargePointId, log }) {
  try {
    await postToLaravel('/status-notification', {
      chargePointId,
      connectorId: payload.connectorId,
      status: payload.status,
    })
  } catch (error) {
    log(`status-notification ingest failed: ${error.message}`)
  }

  return {}
}

async function authorize(payload, { log }) {
  try {
    const result = await postToLaravel('/authorize', { idTag: payload.idTag })
    return { idTagInfo: { status: result.status ?? 'Accepted' } }
  } catch (error) {
    log(`authorize ingest failed: ${error.message}; defaulting to Accepted`)
    return { idTagInfo: { status: 'Accepted' } }
  }
}

async function startTransaction(payload, { chargePointId, log }) {
  try {
    const result = await postToLaravel('/start-transaction', {
      chargePointId,
      connectorId: payload.connectorId,
      idTag: payload.idTag,
      meterStart: payload.meterStart,
    })

    return {
      transactionId: result.transactionId,
      idTagInfo: { status: result.idTagStatus ?? 'Accepted' },
    }
  } catch (error) {
    log(`start-transaction ingest failed: ${error.message}; using a local fallback id`)
    return { transactionId: Date.now() % 1_000_000, idTagInfo: { status: 'Accepted' } }
  }
}

async function stopTransaction(payload, { log }) {
  try {
    await postToLaravel('/stop-transaction', {
      transactionId: payload.transactionId,
      meterStop: payload.meterStop,
    })
  } catch (error) {
    log(`stop-transaction ingest failed: ${error.message}`)
  }

  return { idTagInfo: { status: 'Accepted' } }
}

async function meterValues(payload, { log }) {
  const energyWh = extractEnergyWh(payload.meterValue)

  if (payload.transactionId != null && energyWh !== undefined) {
    try {
      await postToLaravel('/meter-values', {
        transactionId: payload.transactionId,
        energyWh,
      })
    } catch (error) {
      log(`meter-values ingest failed: ${error.message}`)
    }
  }

  return {}
}

const handlers = {
  BootNotification: bootNotification,
  Heartbeat: heartbeat,
  StatusNotification: statusNotification,
  Authorize: authorize,
  StartTransaction: startTransaction,
  StopTransaction: stopTransaction,
  MeterValues: meterValues,
}

/**
 * Routes an OCPP-J CALL to its handler. Actions this CSMS doesn't implement
 * (DiagnosticsStatusNotification, FirmwareStatusNotification, DataTransfer, ...)
 * get a generic empty-accepted reply so the simulator never sees a CALLERROR
 * for something out of scope.
 */
export async function handleAction(action, payload, context) {
  const handler = handlers[action]
  if (!handler) {
    context.log(`unhandled action '${action}', replying with an empty accepted response`)
    return {}
  }

  return handler(payload, context)
}
