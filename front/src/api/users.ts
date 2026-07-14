import { apiClient } from './client'
import type { AppUser, AuthUser } from '../types'

export async function getUsers(): Promise<AppUser[]> {
  const { data } = await apiClient.get<AuthUser[]>('/users')

  return data.map((user) => ({
    id: String(user.id),
    nom: user.name,
    email: user.email,
    role: user.role as AppUser['role'],
    badgeRfid: '',
    phone: user.phone,
    statut: user.is_active ? 'Actif' : 'Bloqué',
    inscrit: user.created_at ? user.created_at.split('T')[0] : '-',
  }))
}
