export type BorneEtat =
  | 'Disponible'
  | 'Occupée'
  | 'Hors service'
  | 'Maintenance'
  | 'Déconnectée'
  | 'Défaut'

export type ConnecteurType = 'CCS' | 'Type2' | 'CHAdeMO' | 'AC' | 'DC'

export interface Connecteur {
  id: string
  type: ConnecteurType
  puissance: number
  etat: BorneEtat
  disponible: boolean
}

export interface Borne {
  id: string
  nom: string
  reference: string
  numeroSerie: string
  modele: string
  fabricant: string
  adresse: string
  ville: string
  lat: number
  lng: number
  firmware: string
  ocpp: '1.6' | '2.0.1'
  puissance: number
  etat: BorneEtat
  dernierHeartbeat: string
  connecteurs: Connecteur[]
}

export type SessionEtat = 'En cours' | 'Terminée' | 'Annulée' | 'En pause'

export interface ChargeSession {
  id: string
  utilisateur: string
  vehicule: string
  borne: string
  connecteur: ConnecteurType
  debut: string
  fin: string | null
  dureeMin: number
  energieKwh: number
  etat: SessionEtat
}

export type UserRole =
  | 'Super Administrateur'
  | 'Exploitant'
  | 'Opérateur'
  | 'Technicien'
  | 'Service Client'
  | 'Client'

export interface AppUser {
  id: string
  nom: string
  email: string
  role: UserRole
  badgeRfid: string
  statut: 'Actif' | 'Bloqué' | 'Expiré'
  inscrit: string
}

export interface Vehicule {
  id: string
  proprietaire: string
  marque: string
  modele: string
  immatriculation: string
  connecteur: ConnecteurType
  capaciteKwh: number
}

export type TicketStatut = 'Ouvert' | 'Planifié' | 'En cours' | 'Résolu'
export type TicketPriorite = 'Basse' | 'Moyenne' | 'Haute' | 'Critique'

export interface TicketMaintenance {
  id: string
  borne: string
  titre: string
  priorite: TicketPriorite
  statut: TicketStatut
  technicien: string
  creeLe: string
  piecesRemplacees: string[]
}

export type AlerteSeverite = 'info' | 'warning' | 'critical'

export interface Alerte {
  id: string
  borne: string
  message: string
  severite: AlerteSeverite
  date: string
  lue: boolean
}
