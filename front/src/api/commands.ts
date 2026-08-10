import { apiClient } from './client'

export interface CommandResult {
  status?: string
  message?: string
}

export async function remoteStart(borneId: string, connectorId: number, idTag: string): Promise<CommandResult> {
  const { data } = await apiClient.post<CommandResult>(`/bornes/${borneId}/commands/remote-start`, {
    connectorId,
    idTag,
  })
  return data
}

export async function remoteStop(borneId: string, connectorId: number): Promise<CommandResult> {
  const { data } = await apiClient.post<CommandResult>(`/bornes/${borneId}/commands/remote-stop`, { connectorId })
  return data
}

export async function unlockConnector(borneId: string, connectorId: number): Promise<CommandResult> {
  const { data } = await apiClient.post<CommandResult>(`/bornes/${borneId}/commands/unlock-connector`, {
    connectorId,
  })
  return data
}

export async function resetBorne(borneId: string, type: 'Soft' | 'Hard'): Promise<CommandResult> {
  const { data } = await apiClient.post<CommandResult>(`/bornes/${borneId}/commands/reset`, { type })
  return data
}
