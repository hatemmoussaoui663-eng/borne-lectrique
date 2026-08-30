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
  /** Resolved display name, when available (mock data only for now). */
  utilisateur?: string
  /** Raw RFID badge presented at Authorize/StartTransaction — what real OCPP sessions actually carry. */
  idTag?: string
  /** No OCPP data source yet (needs Module 8 vehicle records) — mock data only. */
  vehicule?: string
  borne: string
  connecteur: string
  debut: string | null
  fin: string | null
  dureeMin: number
  energieKwh: number
  prix: number
  etat: SessionEtat
}

export type UserRole =
  | 'Super Administrateur'
  | 'Exploitant'
  | 'Opérateur'
  | 'Technicien'
  | 'Service Client'
  | 'Finance'
  | 'Client'

export type PermissionLevel = 'full' | 'read' | 'none'

export type Permissions = Record<string, PermissionLevel>

export type BadgeStatut = 'Actif' | 'Bloqué' | 'Expiré'

export interface Badge {
  id: string
  code: string
  status: BadgeStatut
  expiresAt: string | null
  /** Has this badge authorized at least one charge session? Once true, its code is locked (back office read-only). */
  used: boolean
}

export interface AppUser {
  id: string
  nom: string
  email: string
  role: UserRole
  badge: Badge | null
  phone?: string | null
  statut: 'Actif' | 'Bloqué' | 'Expiré'
  inscrit: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  badge: Badge | null
  role: string
  role_slug: string
  is_active: boolean
  email_verified_at: string | null
  created_at: string
}

export interface Vehicule {
  id: string
  proprietaire: string
  /** RFID badge code of the vehicule's owner, if any. */
  badge: string | null
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
  technicienId: string | null
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

/** Les cinq natures de pièces listées au Module 16 (gestion documentaire). */
export type DocumentType = 'notice' | 'photo' | 'contrat' | 'plan' | 'garantie'

export interface DocumentFichier {
  id: string
  /** `null` = document général du réseau, rattaché à aucune borne en particulier. */
  borneId: string | null
  borne: string | null
  type: DocumentType
  titre: string
  nomFichier: string
  mime: string
  /** Taille en octets. */
  taille: number
  /** Échéance : portée uniquement par les contrats et les garanties. */
  dateExpiration: string | null
  expire: boolean
  ajoutePar: string | null
  ajouteLe: string
}

/** Actions tracées par le journal d'audit (Module 18). */
export type AuditAction =
  | 'connexion'
  | 'connexion_echouee'
  | 'deconnexion'
  | 'creation'
  | 'modification'
  | 'suppression'

/** Diff d'une modification : { champ: { avant, apres } }. */
export type AuditChangements = Record<string, { avant: string | null; apres: string | null } | string | null>

export interface AuditLogEntry {
  id: string
  /** Nom recopié à l'écriture : reste lisible même si le compte a été supprimé. */
  utilisateur: string
  role: string | null
  /** La ligne pointe-t-elle encore vers un compte existant ? */
  compteLie: boolean
  action: AuditAction
  entite: string | null
  entiteId: string | null
  libelle: string
  changements: AuditChangements | null
  ip: string | null
  date: string
}

/** Un binaire de la bibliothèque de firmwares (Module 13). */
export interface Firmware {
  id: string
  version: string
  /** Nuls = firmware générique, applicable à toutes les bornes. */
  fabricant: string | null
  modele: string | null
  notes: string | null
  nomFichier: string
  taille: number
  /** SHA-256 du binaire téléversé. */
  checksum: string
  ajoutePar: string | null
  ajouteLe: string
  deploiements: number | null
}

export type FirmwareStatut =
  | 'en_attente'
  | 'telechargement'
  | 'telecharge'
  | 'installation'
  | 'installe'
  | 'echec'

export interface FirmwareDeployment {
  id: string
  firmwareId: string | null
  version: string
  /** Version portée par la borne avant l'ordre : la cible d'un rollback. */
  versionPrecedente: string | null
  borneId: string
  borne: string | null
  statut: FirmwareStatut
  /** Statut OCPP brut renvoyé par la borne (Downloading, Installed…). */
  ocppStatus: string | null
  message: string | null
  estRollback: boolean
  enCours: boolean
  rollbackPossible: boolean
  demandePar: string | null
  date: string
  majLe: string
}
