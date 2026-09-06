/**
 * Client OCPP 1.6-J minimal : le navigateur se comporte en point de charge.
 *
 * Les trames sont celles du protocole, pas une imitation — le serveur central
 * du projet les traite exactement comme celles d'une vraie borne, et Laravel
 * enregistre donc une session réelle, visible du tableau de bord exploitant.
 */

/** Délai au-delà duquel un appel sans réponse est abandonné. */
const DELAI_REPONSE_MS = 15_000

type Resolution = {
  resoudre: (charge: Record<string, unknown>) => void
  rejeter: (erreur: Error) => void
  minuterie: number
  /** Retenu pour pouvoir nommer la réponse dans le journal. */
  action: string
}

export type EtatConnexion = 'ferme' | 'connexion' | 'ouvert' | 'erreur'

/** Trame observée, pour le journal affiché au client. */
export interface TraceOcpp {
  sens: 'envoi' | 'reception'
  action: string
  charge: unknown
  horodatage: number
}

export class PointDeCharge {
  private socket: WebSocket | null = null

  /** Appels émis en attente de leur CALLRESULT, indexés par uniqueId. */
  private enAttente = new Map<string, Resolution>()

  private readonly surEtat: (etat: EtatConnexion) => void

  /** Notifié à chaque trame, pour donner à voir le dialogue OCPP. */
  private readonly surTrame: ((trace: TraceOcpp) => void) | undefined

  constructor(
    surEtat: (etat: EtatConnexion) => void,
    surTrame?: (trace: TraceOcpp) => void,
  ) {
    this.surEtat = surEtat
    this.surTrame = surTrame
  }

  private tracer(sens: TraceOcpp['sens'], action: string, charge: unknown): void {
    this.surTrame?.({ sens, action, charge, horodatage: Date.now() })
  }

  connecter(urlBase: string, chargePointId: string): Promise<void> {
    this.fermer()
    this.surEtat('connexion')

    return new Promise((resoudre, rejeter) => {
      // Le serveur lit l'identifiant dans le dernier segment du chemin et
      // n'accepte que le sous-protocole ocpp1.6.
      const url = `${urlBase.replace(/\/$/, '')}/OCPP16/${encodeURIComponent(chargePointId)}`
      const socket = new WebSocket(url, 'ocpp1.6')
      this.socket = socket

      socket.onopen = () => {
        this.surEtat('ouvert')
        resoudre()
      }

      socket.onerror = () => {
        this.surEtat('erreur')
        rejeter(new Error("Connexion au serveur OCPP impossible."))
      }

      socket.onclose = () => {
        this.surEtat('ferme')
        // Un appel encore en vol ne recevra jamais sa réponse : mieux vaut le
        // rejeter que laisser l'interface attendre indéfiniment.
        this.enAttente.forEach(({ rejeter: abandonner, minuterie }) => {
          window.clearTimeout(minuterie)
          abandonner(new Error('Connexion OCPP fermée.'))
        })
        this.enAttente.clear()
      }

      socket.onmessage = (evenement) => this.recevoir(String(evenement.data))
    })
  }

  /** Émet un CALL et attend le CALLRESULT correspondant. */
  appeler(action: string, charge: Record<string, unknown>): Promise<Record<string, unknown>> {
    const socket = this.socket

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Le point de charge n’est pas connecté.'))
    }

    const uniqueId = crypto.randomUUID()

    return new Promise((resoudre, rejeter) => {
      const minuterie = window.setTimeout(() => {
        this.enAttente.delete(uniqueId)
        rejeter(new Error(`${action} : pas de réponse du serveur.`))
      }, DELAI_REPONSE_MS)

      this.enAttente.set(uniqueId, { resoudre, rejeter, minuterie, action })
      // [2, uniqueId, action, payload] = CALL au sens OCPP-J.
      socket.send(JSON.stringify([2, uniqueId, action, charge]))
      this.tracer('envoi', action, charge)
    })
  }

  fermer(): void {
    this.socket?.close()
    this.socket = null
  }

  private recevoir(brut: string): void {
    let trame: unknown

    try {
      trame = JSON.parse(brut)
    } catch {
      return
    }

    if (!Array.isArray(trame)) return

    const [type, uniqueId, troisieme, quatrieme] = trame as [number, string, unknown, unknown]
    const attente = this.enAttente.get(uniqueId)

    if (!attente) return

    this.enAttente.delete(uniqueId)
    window.clearTimeout(attente.minuterie)

    if (type === 3) {
      this.tracer('reception', attente.action, troisieme ?? {})
      attente.resoudre((troisieme ?? {}) as Record<string, unknown>)
      return
    }

    // [4, uniqueId, errorCode, errorDescription] = CALLERROR.
    if (type === 4) {
      attente.rejeter(new Error(`${String(troisieme)} ${String(quatrieme ?? '')}`.trim()))
    }
  }
}

/** URL du serveur OCPP, surchargeable par VITE_OCPP_URL. */
export function urlServeurOcpp(): string {
  return import.meta.env.VITE_OCPP_URL ?? 'ws://localhost:8010'
}
