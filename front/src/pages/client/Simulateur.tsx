import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, InputNumber, Segmented, Spin, Tag, message } from 'antd'
import {
  IdcardOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import imageBorne from '../../assets/Borne-de-recharge-e-premium.jpg'
import imageBadge from '../../assets/badge.png'
import imageVoiture from '../../assets/image 1.png'
import { getContexteSimulateur } from '../../api/simulateur'
import type { ContexteSimulateur } from '../../api/simulateur'
import { PointDeCharge, urlServeurOcpp } from '../../api/ocppChargePoint'
import type { EtatConnexion, TraceOcpp } from '../../api/ocppChargePoint'
import './Simulateur.css'

/** Étapes du parcours, dans l'ordre où OCPP les produit. */
type Etape = 'inactif' | 'authentifie' | 'connecte' | 'charge' | 'termine'

const CONNECTEUR = 1

/** Période d'émission des MeterValues, en secondes de simulation. */
const PERIODE_MESURE_S = 5

/** Le chronomètre bat à la seconde ; l'accélérateur multiplie le temps simulé. */
const VITESSES = [1, 30, 120]

const TRACE_CABLE = 'M 18 62 C 38 88, 58 88, 74 64'

function chrono(secondes: number): string {
  const h = Math.floor(secondes / 3600)
  const m = Math.floor((secondes % 3600) / 60)
  const s = Math.floor(secondes % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Parcours affiché en haut : le client voit d'où il vient et ce qui suit. */
const PARCOURS: { etape: Etape; titre: string }[] = [
  { etape: 'inactif', titre: 'Présenter le badge' },
  { etape: 'authentifie', titre: 'Autorisation OCPP' },
  { etape: 'connecte', titre: 'Véhicule branché' },
  { etape: 'charge', titre: 'Recharge en cours' },
  { etape: 'termine', titre: 'Session clôturée' },
]

function heure(horodatage: number): string {
  return new Date(horodatage).toLocaleTimeString('fr-FR')
}

/** Résumé d'une charge OCPP, tronqué pour tenir sur une ligne. */
function resume(charge: unknown): string {
  const texte = JSON.stringify(charge)
  return texte.length > 90 ? `${texte.slice(0, 90)}…` : texte
}

function Ligne({ cle, valeur }: { cle: string; valeur: React.ReactNode }) {
  return (
    <div className="simu-ligne">
      <span className="simu-ligne__cle">{cle}</span>
      <span className="simu-ligne__valeur">{valeur}</span>
    </div>
  )
}

/**
 * Simulateur de recharge de l'espace client (Module 5).
 *
 * Le navigateur ouvre une WebSocket OCPP 1.6-J vers le serveur central et se
 * comporte en point de charge : Authorize, StartTransaction, MeterValues et
 * StopTransaction sont de vraies trames. La session apparaît donc en direct
 * sur le tableau de bord de l'exploitant et donne lieu à une facture réelle,
 * exactement comme une borne du parc.
 */
function Simulateur() {
  const [contexte, setContexte] = useState<ContexteSimulateur | null>(null)
  const [chargement, setChargement] = useState(true)
  const [etatOcpp, setEtatOcpp] = useState<EtatConnexion>('ferme')
  const [etape, setEtape] = useState<Etape>('inactif')
  const [erreur, setErreur] = useState<string | null>(null)
  const [badgePresente, setBadgePresente] = useState(false)
  const [occupe, setOccupe] = useState(false)

  const [batterieInitiale, setBatterieInitiale] = useState(35)
  const [vitesse, setVitesse] = useState(1)
  const [secondes, setSecondes] = useState(0)
  const [transactionId, setTransactionId] = useState<number | null>(null)
  const [traces, setTraces] = useState<TraceOcpp[]>([])

  const borneRef = useRef<PointDeCharge | null>(null)
  // Le tick lit ces valeurs sans que sa minuterie ait à se recréer à chaque
  // seconde, ce qui la ferait dériver.
  const vitesseRef = useRef(vitesse)
  const transactionRef = useRef<number | null>(null)
  const dernierEnvoiRef = useRef(0)
  vitesseRef.current = vitesse

  const puissanceKw = contexte?.borne.puissanceKw ?? 22
  const capaciteKwh = contexte?.vehicule?.capaciteKwh ?? 50
  const prixKwh = contexte?.tarif.prixKwh ?? 0
  const tvaTaux = contexte?.tarif.tvaTaux ?? 0

  // Énergie = puissance x temps. La charge plafonne à 100 % : au-delà,
  // afficher une batterie à 112 % ruinerait la démonstration.
  const energieTheoriqueKwh = (puissanceKw * secondes) / 3600
  const energieMaxKwh = Math.max(0, capaciteKwh * (1 - batterieInitiale / 100))
  const energieKwh = Math.min(energieTheoriqueKwh, energieMaxKwh)
  const batterieActuelle = Math.min(100, batterieInitiale + (energieKwh / capaciteKwh) * 100)
  const pleine = energieMaxKwh > 0 && energieKwh >= energieMaxKwh - 1e-9
  const coutHt = energieKwh * prixKwh
  const coutTtc = coutHt * (1 + tvaTaux / 100)

  /* ------------------------------------------------ chargement du contexte - */

  useEffect(() => {
    let vivant = true

    getContexteSimulateur()
      .then((c) => {
        if (vivant) setContexte(c)
      })
      .catch(() => setErreur('Impossible de charger le contexte du simulateur.'))
      .finally(() => {
        if (vivant) setChargement(false)
      })

    return () => {
      vivant = false
    }
  }, [])

  /* ------------------------------------------------ connexion au serveur --- */

  useEffect(() => {
    if (!contexte) return

    const borne = new PointDeCharge(setEtatOcpp, (trace) =>
      // Borné : un journal qui grandit sans fin finirait par peser sur le
      // rendu, et seules les dernières trames intéressent.
      setTraces((precedentes) => [trace, ...precedentes].slice(0, 40)),
    )
    borneRef.current = borne

    borne
      .connecter(urlServeurOcpp(), contexte.borne.chargePointId)
      .then(async () => {
        // Séquence d'amorçage d'une vraie borne : elle s'annonce, puis
        // déclare son connecteur libre.
        await borne.appeler('BootNotification', {
          chargePointVendor: 'BornElect',
          chargePointModel: 'Simulateur client',
        })
        await borne.appeler('StatusNotification', {
          connectorId: CONNECTEUR,
          status: 'Available',
          errorCode: 'NoError',
        })
      })
      .catch(() =>
        setErreur("Le serveur OCPP est injoignable. Vérifiez qu'il tourne sur le port 8010."),
      )

    return () => {
      borne.fermer()
      borneRef.current = null
    }
  }, [contexte])

  /* ------------------------------------------------------- chronomètre ---- */

  useEffect(() => {
    if (etape !== 'charge') return

    const minuterie = window.setInterval(() => {
      setSecondes((s) => s + vitesseRef.current)
    }, 1000)

    return () => window.clearInterval(minuterie)
  }, [etape])

  // MeterValues : on n'émet pas à chaque seconde, une borne réelle non plus.
  useEffect(() => {
    if (etape !== 'charge' || transactionRef.current === null) return
    if (secondes - dernierEnvoiRef.current < PERIODE_MESURE_S) return

    dernierEnvoiRef.current = secondes
    void borneRef.current
      ?.appeler('MeterValues', {
        connectorId: CONNECTEUR,
        transactionId: transactionRef.current,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: String(Math.round(energieKwh * 1000)),
                measurand: 'Energy.Active.Import.Register',
                unit: 'Wh',
              },
              { value: String(puissanceKw), measurand: 'Power.Active.Import', unit: 'kW' },
              { value: String(Math.round(batterieActuelle)), measurand: 'SoC', unit: 'Percent' },
            ],
          },
        ],
      })
      .catch(() => undefined)
  }, [etape, secondes, energieKwh, batterieActuelle, puissanceKw])

  /* ------------------------------------------------------------ actions --- */

  const presenterBadge = useCallback(async () => {
    if (!contexte?.badge) return

    setErreur(null)
    setBadgePresente(true)
    setOccupe(true)

    try {
      const reponse = await borneRef.current?.appeler('Authorize', {
        idTag: contexte.badge.code,
      })
      const statut = (reponse?.idTagInfo as { status?: string } | undefined)?.status

      if (statut !== 'Accepted') {
        setErreur(`Badge refusé par le système central (${statut ?? 'inconnu'}).`)
        return
      }

      setEtape('authentifie')
      message.success('Autorisation acceptée.')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Autorisation impossible.')
    } finally {
      setOccupe(false)
      // L'animation ne doit jouer qu'une fois : on la réarme au prochain appui.
      window.setTimeout(() => setBadgePresente(false), 1500)
    }
  }, [contexte])

  const brancher = useCallback(async () => {
    setOccupe(true)
    try {
      await borneRef.current?.appeler('StatusNotification', {
        connectorId: CONNECTEUR,
        status: 'Preparing',
        errorCode: 'NoError',
      })
      setEtape('connecte')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion du véhicule impossible.')
    } finally {
      setOccupe(false)
    }
  }, [])

  const demarrer = useCallback(async () => {
    if (!contexte?.badge) return

    setOccupe(true)
    try {
      const reponse = await borneRef.current?.appeler('StartTransaction', {
        connectorId: CONNECTEUR,
        idTag: contexte.badge.code,
        meterStart: 0,
        timestamp: new Date().toISOString(),
      })

      const id = Number(reponse?.transactionId ?? 0)
      if (!id) {
        setErreur("Le système central a refusé d'ouvrir la transaction.")
        return
      }

      transactionRef.current = id
      setTransactionId(id)
      setSecondes(0)
      dernierEnvoiRef.current = 0
      setEtape('charge')

      await borneRef.current?.appeler('StatusNotification', {
        connectorId: CONNECTEUR,
        status: 'Charging',
        errorCode: 'NoError',
      })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Démarrage impossible.')
    } finally {
      setOccupe(false)
    }
  }, [contexte])

  const arreter = useCallback(async () => {
    if (transactionRef.current === null) return

    setOccupe(true)
    try {
      await borneRef.current?.appeler('StopTransaction', {
        transactionId: transactionRef.current,
        meterStop: Math.round(energieKwh * 1000),
        timestamp: new Date().toISOString(),
        idTag: contexte?.badge?.code,
      })
      await borneRef.current?.appeler('StatusNotification', {
        connectorId: CONNECTEUR,
        status: 'Available',
        errorCode: 'NoError',
      })
      setEtape('termine')
      message.success('Session clôturée. Une facture a été émise.')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Arrêt impossible.')
    } finally {
      setOccupe(false)
    }
  }, [contexte, energieKwh])

  function recommencer() {
    setEtape('inactif')
    setSecondes(0)
    setTransactionId(null)
    transactionRef.current = null
    dernierEnvoiRef.current = 0
    setErreur(null)
    setTraces([])
  }

  /* -------------------------------------------------------------- rendu --- */

  if (chargement) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  const branche = etape === 'connecte' || etape === 'charge'
  const enCharge = etape === 'charge'

  const etatBorne =
    etape === 'inactif'
      ? 'Borne disponible'
      : etape === 'authentifie'
        ? 'Autorisation acceptée'
        : etape === 'connecte'
          ? 'Véhicule connecté'
          : etape === 'charge'
            ? 'Recharge en cours'
            : 'Recharge terminée'

  return (
    <div>
      {etatOcpp !== 'ouvert' && (
        <Alert
          type={etatOcpp === 'erreur' ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            etatOcpp === 'connexion'
              ? 'Connexion au serveur OCPP…'
              : 'Point de charge non connecté au serveur OCPP.'
          }
        />
      )}

      {erreur && (
        <Alert
          type="error"
          showIcon
          closable
          message={erreur}
          style={{ marginBottom: 16 }}
          onClose={() => setErreur(null)}
        />
      )}

      {!contexte?.badge && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Aucun badge RFID n'est rattaché à votre compte : l'autorisation sera refusée."
        />
      )}

      {/* Fil du parcours : l'étape courante clignote, les précédentes sont
          cochées. */}
      <div className="simu-etapes">
        {PARCOURS.map((element, index) => {
          const rang = PARCOURS.findIndex((e) => e.etape === etape)
          const faite = index < rang
          const active = index === rang

          return (
            <div
              key={element.etape}
              className={`simu-etape${faite ? ' simu-etape--faite' : ''}${
                active ? ' simu-etape--active' : ''
              }`}
            >
              <span className="simu-etape__puce">{faite ? '✓' : index + 1}</span>
              {element.titre}
            </div>
          )
        })}
      </div>

      {/* ------------------------------------------------------- la scène -- */}

      <div
        className={`simu-scene${branche ? ' simu-scene--branche' : ''}${
          enCharge ? ' simu-scene--charge' : ''
        }`}
      >
        <svg
          className={`simu-cable${branche ? ' simu-cable--branche' : ''}${
            enCharge ? ' simu-cable--charge' : ''
          }`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Part du pied de la borne, plonge, puis remonte vers la trappe de
              charge de la voiture. */}
          <path className="simu-cable__trace" d={TRACE_CABLE} />
          {enCharge && <path className="simu-cable__flux" d={TRACE_CABLE} />}
        </svg>

        <div className="simu-scene__bloc simu-scene__borne">
          <img className="simu-scene__image" src={imageBorne} alt="Borne de recharge" />
          <Tag color={enCharge ? 'green' : 'default'}>{etatBorne}</Tag>
        </div>

        <div className="simu-scene__bloc">
          <img
            className={`simu-badge${badgePresente ? ' simu-badge--presente' : ''}${
              etape !== 'inactif' ? ' simu-badge--valide' : ''
            }`}
            src={imageBadge}
            alt="Badge RFID"
          />
          <span className="simu-scene__legende">
            {contexte?.badge ? contexte.badge.code : 'Aucun badge'}
          </span>
        </div>

        <div className="simu-scene__bloc simu-scene__voiture">
          <img className="simu-scene__image" src={imageVoiture} alt="Véhicule électrique" />
          <span className="simu-scene__legende">
            {contexte?.vehicule
              ? `${contexte.vehicule.marque} ${contexte.vehicule.modele}`
              : 'Aucun véhicule'}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------ commandes -- */}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
        {etape === 'inactif' && (
          <>
            <Button
              type="primary"
              size="large"
              icon={<IdcardOutlined />}
              loading={occupe}
              disabled={!contexte?.badge || etatOcpp !== 'ouvert'}
              onClick={() => void presenterBadge()}
            >
              Présenter le badge
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Batterie initiale
              <InputNumber
                min={0}
                max={99}
                value={batterieInitiale}
                onChange={(v) => setBatterieInitiale(v ?? 0)}
                addonAfter="%"
                style={{ width: 120 }}
              />
            </span>
          </>
        )}

        {etape === 'authentifie' && (
          <Button
            type="primary"
            size="large"
            icon={<ApiOutlined />}
            loading={occupe}
            onClick={() => void brancher()}
          >
            Brancher le véhicule
          </Button>
        )}

        {etape === 'connecte' && (
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            loading={occupe}
            onClick={() => void demarrer()}
          >
            Démarrer la recharge
          </Button>
        )}

        {enCharge && (
          <>
            <Button
              danger
              type="primary"
              size="large"
              icon={<StopOutlined />}
              loading={occupe}
              onClick={() => void arreter()}
            >
              Arrêter la recharge
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Vitesse
              <Segmented
                value={vitesse}
                onChange={(v) => setVitesse(Number(v))}
                options={VITESSES.map((v) => ({ label: `x${v}`, value: v }))}
              />
            </span>
          </>
        )}

        {etape === 'termine' && (
          <Button size="large" onClick={recommencer}>
            Nouvelle simulation
          </Button>
        )}
      </div>

      {pleine && enCharge && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Batterie pleine : la puissance retombe à zéro, vous pouvez arrêter la session."
        />
      )}

      {/* ------------------------------------------------------- panneaux -- */}

      <div className="simu-panneaux">
        <Card size="small" title="Client">
          <Ligne cle="Nom et prénom" valeur={contexte?.client.nom ?? '—'} />
          <Ligne cle="Identifiant client" valeur={contexte?.client.id ?? '—'} />
          <Ligne cle="Badge RFID" valeur={contexte?.badge?.code ?? 'Aucun'} />
          <Ligne cle="Solde disponible" valeur={`${(contexte?.solde ?? 0).toFixed(3)} DT`} />
        </Card>

        <Card size="small" title="Véhicule">
          <Ligne cle="Marque" valeur={contexte?.vehicule?.marque ?? '—'} />
          <Ligne cle="Modèle" valeur={contexte?.vehicule?.modele ?? '—'} />
          <Ligne cle="Immatriculation" valeur={contexte?.vehicule?.immatriculation ?? '—'} />
          <Ligne cle="Capacité batterie" valeur={`${capaciteKwh} kWh`} />
          <Ligne cle="Batterie initiale" valeur={`${batterieInitiale} %`} />
          <Ligne cle="Batterie actuelle" valeur={`${batterieActuelle.toFixed(1)} %`} />
          <div className="simu-jauge">
            <div
              className={`simu-jauge__niveau${enCharge && !pleine ? ' simu-jauge__niveau--actif' : ''}`}
              style={{ width: `${batterieActuelle}%` }}
            />
          </div>
        </Card>

        <Card size="small" title="Recharge">
          <div className="simu-chrono">{chrono(secondes)}</div>
          <Ligne cle="État" valeur={etatBorne} />
          <Ligne cle="Transaction OCPP" valeur={transactionId ?? '—'} />
          <Ligne cle="Énergie consommée" valeur={`${energieKwh.toFixed(3)} kWh`} />
          <Ligne
            cle="Puissance instantanée"
            valeur={`${enCharge && !pleine ? puissanceKw : 0} kW`}
          />
          <Ligne cle="Coût HT" valeur={`${coutHt.toFixed(3)} DT`} />
          <Ligne cle={`Coût TTC (TVA ${tvaTaux} %)`} valeur={`${coutTtc.toFixed(3)} DT`} />
        </Card>
      </div>


      <Card size="small" title="Dialogue OCPP" style={{ marginTop: 16 }}>
        {traces.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>
            Les trames échangées avec le système central s’afficheront ici.
          </span>
        ) : (
          <div className="simu-journal">
            {traces.map((trace) => (
              <div
                className="simu-journal__ligne"
                key={`${trace.horodatage}-${trace.sens}-${trace.action}`}
              >
                <span className="simu-journal__heure">{heure(trace.horodatage)}</span>
                <span className={`simu-journal__sens simu-journal__sens--${trace.sens}`}>
                  {trace.sens === 'envoi' ? '→' : '←'}
                </span>
                <span className="simu-journal__action">{trace.action}</span>
                <span className="simu-journal__charge">{resume(trace.charge)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {etape === 'termine' && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={
            <>
              <CheckCircleOutlined style={{ color: '#2dbe6e' }} /> Recharge terminée
            </>
          }
        >
          <Ligne cle="Durée" valeur={chrono(secondes)} />
          <Ligne cle="Énergie consommée" valeur={`${energieKwh.toFixed(3)} kWh`} />
          <Ligne
            cle="Batterie"
            valeur={`${batterieInitiale} % → ${batterieActuelle.toFixed(0)} %`}
          />
          <Ligne cle="Coût total TTC" valeur={`${coutTtc.toFixed(3)} DT`} />
          <Ligne cle="Statut" valeur={<Tag color="green">Recharge terminée</Tag>} />
        </Card>
      )}
    </div>
  )
}

export default Simulateur
