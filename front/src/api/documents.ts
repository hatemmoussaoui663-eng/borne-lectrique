import { apiClient } from './client'
import type { DocumentFichier, DocumentType } from '../types'

export interface DocumentFilters {
  borneId?: string
  type?: DocumentType
}

export interface DocumentInput {
  borneId?: string | null
  type: DocumentType
  titre: string
  /** Format ISO `YYYY-MM-DD`. Ignoré côté serveur hors contrat/garantie. */
  dateExpiration?: string | null
  fichier: File
}

export async function getDocuments(filters: DocumentFilters = {}): Promise<DocumentFichier[]> {
  const { data } = await apiClient.get<DocumentFichier[]>('/documents', {
    params: {
      borne_id: filters.borneId || undefined,
      type: filters.type || undefined,
    },
  })
  return data
}

export async function uploadDocument(input: DocumentInput): Promise<DocumentFichier> {
  const body = new FormData()
  if (input.borneId) body.append('borne_id', input.borneId)
  body.append('type', input.type)
  body.append('titre', input.titre)
  if (input.dateExpiration) body.append('date_expiration', input.dateExpiration)
  body.append('fichier', input.fichier)

  // Pas de Content-Type explicite : axios pose lui-même le boundary multipart.
  const { data } = await apiClient.post<DocumentFichier>('/documents', body)
  return data
}

/**
 * Les fichiers vivent sur un disque privé, jamais servis en statique : on
 * passe par l'API authentifiée et on récupère un Blob, qu'il s'agisse de
 * télécharger la pièce ou d'en afficher l'aperçu.
 */
export async function fetchDocumentBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/documents/${id}/download`, {
    responseType: 'blob',
  })
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`)
}
