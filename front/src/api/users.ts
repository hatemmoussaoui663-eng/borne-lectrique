import { apiClient } from './client'
import type { AppUser, AuthUser, BadgeStatut } from '../types'

function toAppUser(user: AuthUser): AppUser {
  return {
    id: String(user.id),
    nom: user.name,
    email: user.email,
    role: user.role as AppUser['role'],
    badge: user.badge,
    phone: user.phone,
    statut: user.is_active ? 'Actif' : 'Bloqué',
    inscrit: user.created_at ? user.created_at.split('T')[0] : '-',
  }
}

export async function getUsers(): Promise<AppUser[]> {
  const { data } = await apiClient.get<AuthUser[]>('/users')
  return data.map(toAppUser)
}

export interface BadgeInput {
  code: string
  status?: BadgeStatut
  expiresAt?: string | null
}

export async function updateUserBadge(id: string, badge: BadgeInput): Promise<AppUser> {
  const { data } = await apiClient.put<AuthUser>(`/users/${id}/badge`, {
    code: badge.code || null,
    status: badge.status,
    expires_at: badge.expiresAt || null,
  })
  return toAppUser(data)
}
