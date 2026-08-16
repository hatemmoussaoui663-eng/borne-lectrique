import { apiClient } from './client'

export interface Role {
  id: number
  name: string
  displayName: string
}

export async function getRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>('/roles')
  return data
}
