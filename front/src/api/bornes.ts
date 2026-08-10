import { apiClient } from './client'

export interface BorneOption {
  id: string
  nom: string
}

export async function getBorneOptions(): Promise<BorneOption[]> {
  const { data } = await apiClient.get('/bornes')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((b: any) => ({ id: String(b.id), nom: b.name ?? b.nom ?? '' }))
}
