import { apiClient } from './client'
import type { AppUser, AuthUser } from '../types'

function toAppUser(user: AuthUser): AppUser {
  return {
    id: String(user.id),
    nom: user.name,
    email: user.email,
    role: user.role as AppUser['role'],
    badgeRfid: user.badge_rfid ?? '',
    phone: user.phone,
    statut: user.is_active ? 'Actif' : 'Bloqué',
    inscrit: user.created_at ? user.created_at.split('T')[0] : '-',
  }
}

export async function getUsers(): Promise<AppUser[]> {
  const { data } = await apiClient.get<AuthUser[]>('/users')
  return data.map(toAppUser)
}

export async function updateUserBadge(id: string, badgeRfid: string): Promise<AppUser> {
  const { data } = await apiClient.put<AuthUser>(`/users/${id}`, {
    badge_rfid: badgeRfid || null,
  })
  return toAppUser(data)
}
