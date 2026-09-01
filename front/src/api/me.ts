import { apiClient } from './client'
import type { ChargeSession, Vehicule } from '../types'

export async function getMySessions(vehiculeId?: string): Promise<ChargeSession[]> {
  const { data } = await apiClient.get<ChargeSession[]>('/me/sessions', {
    params: { vehicule_id: vehiculeId || undefined },
  })
  return data
}

/**
 * Rattache un véhicule à l'une de mes sessions, ou le détache (`null`).
 * OCPP ne dit pas quelle voiture était branchée : quand j'en ai plusieurs,
 * c'est moi qui complète l'information.
 */
export async function affecterVehiculeSession(
  sessionId: string,
  vehiculeId: string | null,
): Promise<ChargeSession> {
  const { data } = await apiClient.put<ChargeSession>(`/me/sessions/${sessionId}/vehicule`, {
    vehicule_id: vehiculeId === null ? null : Number(vehiculeId),
  })
  return data
}

export interface MyVehiculeInput {
  marque: string
  modele: string
  immatriculation: string
  connecteur: Vehicule['connecteur']
  capaciteKwh: number
}

function toPayload(input: MyVehiculeInput) {
  return {
    marque: input.marque,
    modele: input.modele,
    immatriculation: input.immatriculation,
    connecteur_type: input.connecteur,
    capacite_kwh: input.capaciteKwh,
  }
}

export async function getMyVehicules(): Promise<Vehicule[]> {
  const { data } = await apiClient.get<Vehicule[]>('/me/vehicules')
  return data
}

export async function createMyVehicule(input: MyVehiculeInput): Promise<Vehicule> {
  const { data } = await apiClient.post<Vehicule>('/me/vehicules', toPayload(input))
  return data
}

export async function updateMyVehicule(id: string, input: MyVehiculeInput): Promise<Vehicule> {
  const { data } = await apiClient.put<Vehicule>(`/me/vehicules/${id}`, toPayload(input))
  return data
}

export async function deleteMyVehicule(id: string): Promise<void> {
  await apiClient.delete(`/me/vehicules/${id}`)
}
