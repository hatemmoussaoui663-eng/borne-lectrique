import { apiClient } from './client'
import type { Vehicule } from '../types'

export interface VehiculeInput {
  userId?: string | null
  marque: string
  modele: string
  immatriculation: string
  connecteur: Vehicule['connecteur']
  capaciteKwh: number
}

function toPayload(input: VehiculeInput) {
  return {
    user_id: input.userId || null,
    marque: input.marque,
    modele: input.modele,
    immatriculation: input.immatriculation,
    connecteur_type: input.connecteur,
    capacite_kwh: input.capaciteKwh,
  }
}

export async function getVehicules(): Promise<Vehicule[]> {
  const { data } = await apiClient.get<Vehicule[]>('/vehicules')
  return data
}

export async function createVehicule(input: VehiculeInput): Promise<Vehicule> {
  const { data } = await apiClient.post<Vehicule>('/vehicules', toPayload(input))
  return data
}

export async function updateVehicule(id: string, input: VehiculeInput): Promise<Vehicule> {
  const { data } = await apiClient.put<Vehicule>(`/vehicules/${id}`, toPayload(input))
  return data
}

export async function deleteVehicule(id: string): Promise<void> {
  await apiClient.delete(`/vehicules/${id}`)
}
