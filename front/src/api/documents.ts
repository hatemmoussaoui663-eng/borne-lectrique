import { apiClient } from './client'
import type { DocumentFichier, DocumentType, RoleDestinataire } from '../types'

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
  /** Identifiants des rôles visés. Vide = visible de tous les métiers. */
  roleIds?: string[]
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

/**
 * Nombre de documents jamais ouverts par l'utilisateur courant, pour la
 * pastille du menu. Volontairement distinct de getDocuments : le layout le
 * rappelle a chaque navigation et n'a pas besoin des fiches.
 */
export async function getCompteurDocumentsNonLus(): Promise<number> {
  const { data } = await apiClient.get<{ total: number }>('/documents/compteur-non-lus')
  return data.total
}

/**
 * Previent le reste de l'application que la liste des documents a bouge :
 * piece consultee, deposee ou supprimee. Un evenement plutot qu'un contexte
 * partage, la page Documents n'ayant pas a connaitre son parent.
 *
 * Ne couvre que l'onglet courant : une pièce deposee par quelqu'un d'autre
 * arrive par le rafraichissement periodique du layout.
 */
export const EVENEMENT_DOCUMENTS_CHANGES = 'bornelect:documents-changes'

export function signalerDocumentsChanges(): void {
  window.dispatchEvent(new CustomEvent(EVENEMENT_DOCUMENTS_CHANGES))
}

/**
 * Emis par le layout quand sa relecture periodique constate que des pieces
 * sont apparues. La page Documents s'y raccroche pour recharger sa liste :
 * sans ca, la pastille annoncerait des nouveautes que le tableau n'affiche
 * pas encore.
 */
export const EVENEMENT_NOUVEAUX_DOCUMENTS = 'bornelect:nouveaux-documents'

export function signalerNouveauxDocuments(): void {
  window.dispatchEvent(new CustomEvent(EVENEMENT_NOUVEAUX_DOCUMENTS))
}

/** Rôles que l'administrateur peut viser en déposant un document. */
export async function getDestinatairesPossibles(): Promise<RoleDestinataire[]> {
  const { data } = await apiClient.get<RoleDestinataire[]>('/documents/destinataires')
  return data
}

export async function uploadDocument(input: DocumentInput): Promise<DocumentFichier> {
  const body = new FormData()
  if (input.borneId) body.append('borne_id', input.borneId)
  body.append('type', input.type)
  body.append('titre', input.titre)
  if (input.dateExpiration) body.append('date_expiration', input.dateExpiration)
  input.roleIds?.forEach((id) => body.append('roles[]', id))
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
