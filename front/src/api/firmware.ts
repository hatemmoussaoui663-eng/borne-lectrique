import { apiClient } from './client'
import type { Firmware, FirmwareDeployment, FirmwareStatut } from '../types'

export interface FirmwareInput {
  version: string
  fabricant?: string | null
  modele?: string | null
  notes?: string | null
  fichier: File
}

/** Une ligne du compte rendu de déploiement, borne par borne. */
export interface ResultatDeploiement {
  borne: string
  succes: boolean
  message: string | null
}

export interface ReponseDeploiement {
  message: string
  resultats: ResultatDeploiement[]
}

export async function getFirmwares(): Promise<Firmware[]> {
  const { data } = await apiClient.get<Firmware[]>('/firmwares')
  return data
}

export async function uploadFirmware(input: FirmwareInput): Promise<Firmware> {
  const body = new FormData()
  body.append('version', input.version)
  if (input.fabricant) body.append('fabricant', input.fabricant)
  if (input.modele) body.append('modele', input.modele)
  if (input.notes) body.append('notes', input.notes)
  body.append('fichier', input.fichier)

  const { data } = await apiClient.post<Firmware>('/firmwares', body)
  return data
}

export async function deleteFirmware(id: string): Promise<void> {
  await apiClient.delete(`/firmwares/${id}`)
}

/** Envoie un `UpdateFirmware` à chaque borne ; la réponse détaille chaque cas. */
export async function deployerFirmware(
  id: string,
  borneIds: string[],
): Promise<ReponseDeploiement> {
  const { data } = await apiClient.post<ReponseDeploiement>(`/firmwares/${id}/deployer`, {
    borne_ids: borneIds.map(Number),
  })
  return data
}

export async function getDeployments(filtres: {
  borneId?: string
  statut?: FirmwareStatut
} = {}): Promise<FirmwareDeployment[]> {
  const { data } = await apiClient.get<FirmwareDeployment[]>('/firmware-deployments', {
    params: {
      borne_id: filtres.borneId || undefined,
      statut: filtres.statut || undefined,
    },
  })
  return data
}

export async function rollbackDeployment(id: string): Promise<ReponseDeploiement> {
  const { data } = await apiClient.post<ReponseDeploiement>(
    `/firmware-deployments/${id}/rollback`,
  )
  return data
}
