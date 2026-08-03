import { apiClient } from './client'

export interface DashboardData {
  totalBornes: number
  bornesActives: number
  bornesIndisponibles: number
  sessionsAujourdhui: number
  kwhDelivres: number
  dureeMoyenneMin: number
  consumptionSeries: { days: string[]; kwh: number[] }
}

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await apiClient.get<DashboardData>('/dashboard')
  return data
}
