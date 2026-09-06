import { apiClient } from './client'

/** Tout ce dont le simulateur a besoin pour composer ses trames OCPP. */
export interface ContexteSimulateur {
  client: { id: string; nom: string; email: string }
  /** `null` si le client n'a aucun badge : la borne refuserait l'autorisation. */
  badge: { code: string; statut: string; expireLe: string | null } | null
  vehicule: {
    id: string
    marque: string
    modele: string
    immatriculation: string
    connecteur: string
    capaciteKwh: number
  } | null
  solde: number
  tarif: { prixKwh: number; tvaTaux: number }
  borne: { chargePointId: string; nom: string; puissanceKw: number }
}

export async function getContexteSimulateur(): Promise<ContexteSimulateur> {
  const { data } = await apiClient.get<ContexteSimulateur>('/me/simulateur/contexte')
  return data
}
