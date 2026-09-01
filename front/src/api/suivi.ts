import { apiClient } from './client'
import type { Borne, Vehicule } from '../types'

/** Une borne accompagnée de sa distance au point interrogé. */
export interface BorneProche extends Borne {
  distanceKm: number
}

export interface PositionInput {
  lat: number
  lng: number
  /** Rayon d'incertitude en mètres, tel que rapporté par la source GPS. */
  precisionM?: number | null
}

/**
 * Transmet la position du véhicule. Le contrat est le même que la source soit
 * le navigateur embarqué ou un boîtier télématique.
 */
export async function envoyerPosition(
  vehiculeId: string,
  position: PositionInput,
): Promise<Vehicule> {
  const { data } = await apiClient.post<Vehicule>(`/me/vehicules/${vehiculeId}/position`, {
    lat: position.lat,
    lng: position.lng,
    precision_m: position.precisionM ?? undefined,
  })
  return data
}

/** Bornes les plus proches d'un point, la plus proche en tête. */
export async function getBornesProches(
  lat: number,
  lng: number,
  options: { limite?: number; disponiblesSeulement?: boolean } = {},
): Promise<BorneProche[]> {
  const { data } = await apiClient.get<BorneProche[]>('/bornes/proches', {
    params: {
      lat,
      lng,
      limite: options.limite ?? 5,
      disponibles: options.disponiblesSeulement ? 1 : undefined,
    },
  })
  return data
}
