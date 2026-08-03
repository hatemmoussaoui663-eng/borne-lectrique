import { apiClient } from './client'
import type { Alerte } from '../types'

export async function getAlertes(): Promise<Alerte[]> {
  const { data } = await apiClient.get<Alerte[]>('/alertes')
  return data
}

export async function markAlerteRead(id: string): Promise<Alerte> {
  const { data } = await apiClient.patch<Alerte>(`/alertes/${id}/read`)
  return data
}
