import { apiClient } from './client'
import type { ChargeSession } from '../types'

export async function getSessions(): Promise<ChargeSession[]> {
  const { data } = await apiClient.get<ChargeSession[]>('/sessions')
  return data
}
