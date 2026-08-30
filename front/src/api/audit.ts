import { apiClient } from './client'
import type { AuditAction, AuditLogEntry } from '../types'

export interface AuditFilters {
  action?: AuditAction
  entite?: string
  recherche?: string
  /** Bornes de période au format ISO `YYYY-MM-DD`, incluses toutes les deux. */
  du?: string
  au?: string
  page?: number
  parPage?: number
}

export interface AuditPage {
  data: AuditLogEntry[]
  total: number
  page: number
  parPage: number
}

/** Les filtres voyagent en snake_case, comme le reste de l'API Laravel. */
function toParams(filters: AuditFilters) {
  return {
    action: filters.action || undefined,
    entite: filters.entite || undefined,
    recherche: filters.recherche || undefined,
    du: filters.du || undefined,
    au: filters.au || undefined,
    page: filters.page,
    par_page: filters.parPage,
  }
}

export async function getAuditLogs(filters: AuditFilters = {}): Promise<AuditPage> {
  const { data } = await apiClient.get<AuditPage>('/audit-logs', { params: toParams(filters) })
  return data
}

/** Export CSV : passe par l'API authentifiée, donc récupéré en Blob. */
export async function exportAuditLogs(filters: AuditFilters = {}): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/audit-logs/export', {
    params: toParams(filters),
    responseType: 'blob',
  })
  return data
}
