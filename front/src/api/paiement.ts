import { apiClient } from './client'
import type {
  Abonnement,
  AbonnementPlan,
  Facture,
  FactureStatut,
  MoyenPaiement,
  Paiement,
  Wallet,
} from '../types'

/* ------------------------------------------------------------- Factures --- */

export interface FactureFilters {
  statut?: FactureStatut
  recherche?: string
  enRetard?: boolean
}

export async function getFactures(filtres: FactureFilters = {}): Promise<Facture[]> {
  const { data } = await apiClient.get<Facture[]>('/factures', {
    params: {
      statut: filtres.statut || undefined,
      recherche: filtres.recherche || undefined,
      en_retard: filtres.enRetard ? 1 : undefined,
    },
  })
  return data
}

export async function genererFactures(joursEcheance?: number): Promise<{
  message: string
  emises: number
  ignorees: number
}> {
  const { data } = await apiClient.post('/factures/generer', {
    jours_echeance: joursEcheance,
  })
  return data
}

export async function reglerFacture(
  id: string,
  moyen: MoyenPaiement,
  options: { reference?: string; joursEcheance?: number } = {},
): Promise<{ message: string; facture: Facture; paiement: Paiement }> {
  const { data } = await apiClient.post(`/factures/${id}/regler`, {
    moyen,
    reference: options.reference || undefined,
    jours_echeance: options.joursEcheance,
  })
  return data
}

/** Le PDF passe par l'API authentifiée : récupéré en Blob, jamais par lien direct. */
export async function facturePdf(id: string, espaceClient = false): Promise<Blob> {
  const prefixe = espaceClient ? '/me/factures' : '/factures'
  const { data } = await apiClient.get<Blob>(`${prefixe}/${id}/pdf`, {
    responseType: 'blob',
  })
  return data
}

/* ------------------------------------------------------------ Paiements --- */

export async function getPaiements(filtres: { moyen?: MoyenPaiement } = {}): Promise<Paiement[]> {
  const { data } = await apiClient.get<Paiement[]>('/paiements', {
    params: { moyen: filtres.moyen || undefined },
  })
  return data
}

export async function rembourserPaiement(
  id: string,
  motif: string,
): Promise<{ message: string; paiement: Paiement }> {
  const { data } = await apiClient.post(`/paiements/${id}/rembourser`, { motif })
  return data
}

/* -------------------------------------------------------------- Wallets --- */

export async function getWallets(): Promise<Wallet[]> {
  const { data } = await apiClient.get<Wallet[]>('/wallets')
  return data
}

export async function getWallet(id: string): Promise<Wallet> {
  const { data } = await apiClient.get<Wallet>(`/wallets/${id}`)
  return data
}

export async function crediterWallet(
  userId: string,
  montant: number,
  motif?: string,
): Promise<{ message: string; wallet: Wallet }> {
  const { data } = await apiClient.post('/wallets/crediter', {
    user_id: Number(userId),
    montant,
    motif: motif || undefined,
  })
  return data
}

/**
 * Contre-passe un rechargement saisi par erreur. Il n'existe pas de suppression :
 * le mouvement fautif et sa correction restent tous deux à l'historique.
 */
export async function annulerRechargement(
  transactionId: string,
  motif?: string,
): Promise<{ message: string; wallet: Wallet }> {
  const { data } = await apiClient.post(`/wallets/transactions/${transactionId}/annuler`, {
    motif: motif || undefined,
  })
  return data
}

/** Retrait libre, pour corriger un rechargement déjà partiellement dépensé. */
export async function debiterWallet(
  userId: string,
  montant: number,
  motif: string,
): Promise<{ message: string; wallet: Wallet }> {
  const { data } = await apiClient.post('/wallets/debiter', {
    user_id: Number(userId),
    montant,
    motif,
  })
  return data
}

/* ---------------------------------------------------------- Abonnements --- */

export interface PlanInput {
  nom: string
  description?: string | null
  prixMensuel: number
  remisePourcent: number
  actif: boolean
}

function planPayload(input: PlanInput) {
  return {
    nom: input.nom,
    description: input.description || null,
    prix_mensuel: input.prixMensuel,
    remise_pourcent: input.remisePourcent,
    actif: input.actif,
  }
}

export async function getPlans(): Promise<AbonnementPlan[]> {
  const { data } = await apiClient.get<AbonnementPlan[]>('/abonnement-plans')
  return data
}

export async function createPlan(input: PlanInput): Promise<AbonnementPlan> {
  const { data } = await apiClient.post<AbonnementPlan>('/abonnement-plans', planPayload(input))
  return data
}

export async function updatePlan(id: string, input: PlanInput): Promise<AbonnementPlan> {
  const { data } = await apiClient.put<AbonnementPlan>(`/abonnement-plans/${id}`, planPayload(input))
  return data
}

export async function deletePlan(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.delete(`/abonnement-plans/${id}`)
  return data
}

export async function getAbonnements(): Promise<Abonnement[]> {
  const { data } = await apiClient.get<Abonnement[]>('/abonnements')
  return data
}

export async function souscrire(
  userId: string,
  planId: string,
): Promise<{ message: string; abonnement: Abonnement }> {
  const { data } = await apiClient.post('/abonnements', {
    user_id: Number(userId),
    abonnement_plan_id: Number(planId),
  })
  return data
}

export async function resilier(id: string): Promise<{ message: string; abonnement: Abonnement }> {
  const { data } = await apiClient.post(`/abonnements/${id}/resilier`)
  return data
}

/* -------------------------------------------------------- Espace client --- */

export async function getMesFactures(): Promise<Facture[]> {
  const { data } = await apiClient.get<Facture[]>('/me/factures')
  return data
}

export async function getMonWallet(): Promise<Wallet> {
  const { data } = await apiClient.get<Wallet>('/me/wallet')
  return data
}

export async function getMesAbonnements(): Promise<Abonnement[]> {
  const { data } = await apiClient.get<Abonnement[]>('/me/abonnements')
  return data
}
