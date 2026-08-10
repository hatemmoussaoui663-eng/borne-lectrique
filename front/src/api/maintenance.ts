import { apiClient } from './client'
import type { TicketMaintenance, TicketPriorite, TicketStatut } from '../types'

export interface TicketInput {
  borneId: string
  titre: string
  priorite: TicketPriorite
  statut?: TicketStatut
  technicien?: string
  piecesRemplacees?: string[]
}

function toPayload(input: Partial<TicketInput>) {
  return {
    borne_id: input.borneId,
    titre: input.titre,
    priorite: input.priorite,
    statut: input.statut,
    technicien: input.technicien,
    pieces_remplacees: input.piecesRemplacees,
  }
}

export async function getTickets(): Promise<TicketMaintenance[]> {
  const { data } = await apiClient.get<TicketMaintenance[]>('/maintenance-tickets')
  return data
}

export async function createTicket(input: TicketInput): Promise<TicketMaintenance> {
  const { data } = await apiClient.post<TicketMaintenance>('/maintenance-tickets', toPayload(input))
  return data
}

export async function updateTicketStatut(id: string, statut: TicketStatut): Promise<TicketMaintenance> {
  const { data } = await apiClient.put<TicketMaintenance>(`/maintenance-tickets/${id}`, { statut })
  return data
}
