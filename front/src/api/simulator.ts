import { apiClient } from './client'

export interface SimulatorStatusResponse {
  connected: boolean
  status: string
  state: Record<string, unknown>
  message?: string | null
}

export async function getSimulatorStatus(): Promise<SimulatorStatusResponse> {
  const { data } = await apiClient.get<SimulatorStatusResponse>('/simulator/status')
  return data
}

export async function startSimulator(): Promise<SimulatorStatusResponse> {
  const { data } = await apiClient.post<SimulatorStatusResponse>('/simulator/start', {})
  return data
}

export async function stopSimulator(): Promise<SimulatorStatusResponse> {
  const { data } = await apiClient.post<SimulatorStatusResponse>('/simulator/stop', {})
  return data
}
