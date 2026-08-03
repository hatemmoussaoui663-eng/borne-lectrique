import { apiClient } from './client'

export interface Tarif {
  prixKwh: number
}

export async function getTarif(): Promise<Tarif> {
  const { data } = await apiClient.get<Tarif>('/tarif')
  return data
}

export async function updateTarif(prixKwh: number): Promise<Tarif> {
  const { data } = await apiClient.put<Tarif>('/tarif', { prixKwh })
  return data
}
