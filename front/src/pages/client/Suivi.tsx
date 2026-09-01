import { useCallback, useEffect, useRef, useState } from 'react'
import { Select, Button, Table, Tag, Alert, Switch, Tooltip, message } from 'antd'
import {
  AimOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import BornesMap from '../../components/admin/BornesMap'
import StatusTag from '../../components/admin/StatusTag'
import StatCard from '../../components/admin/StatCard'
import { apiClient } from '../../api/client'
import { envoyerPosition, getBornesProches, type BorneProche } from '../../api/suivi'
import type { Vehicule } from '../../types'

/**
 * Intervalle minimal entre deux envois au serveur. Le GPS peut émettre
 * plusieurs points par seconde ; tout relayer saturerait l'API sans rien
 * apporter, la carte étant déjà rafraîchie localement à chaque point.
 */
const INTERVALLE_ENVOI_MS = 10_000

/** Au-delà, on recalcule les bornes proches : en deçà le classement ne bouge pas. */
const DISTANCE_RECALCUL_M = 200

/** Distance approximative en mètres entre deux points proches (Haversine). */
function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6_371_000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`
}

function ClientSuivi() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [vehiculeId, setVehiculeId] = useState<string | undefined>()
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [suiviActif, setSuiviActif] = useState(false)
  const [erreurGps, setErreurGps] = useState<string | null>(null)
  const [proches, setProches] = useState<BorneProche[]>([])
  const [disponiblesSeulement, setDisponiblesSeulement] = useState(false)

  // Refs plutôt que state : ces valeurs sont lues dans le callback de
  // `watchPosition`, qui capture la portée de son enregistrement et ne verrait
  // jamais les mises à jour d'un state.
  const watchId = useRef<number | null>(null)
  const dernierEnvoi = useRef<number>(0)
  const dernierCalcul = useRef<[number, number] | null>(null)

  const vehicule = vehicules.find((v) => v.id === vehiculeId) ?? null

  useEffect(() => {
    apiClient
      .get<Vehicule[]>('/me/vehicules')
      .then(({ data }) => {
        setVehicules(data)
        if (data.length > 0) setVehiculeId(data[0].id)
        // Reprendre la dernière position connue évite un écran vide avant le
        // premier point GPS, qui peut mettre plusieurs secondes à arriver.
        const avecPosition = data.find((v) => v.position)
        if (avecPosition?.position) {
          void rafraichirProches(avecPosition.position.lat, avecPosition.position.lng)
        }
      })
      .catch(() => message.error('Impossible de charger vos véhicules.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rafraichirProches = useCallback(
    async (lat: number, lng: number) => {
      try {
        setProches(await getBornesProches(lat, lng, { limite: 5, disponiblesSeulement }))
        dernierCalcul.current = [lat, lng]
      } catch {
        message.error('Impossible de calculer les bornes les plus proches.')
      }
    },
    [disponiblesSeulement],
  )

  // Un changement de filtre doit recalculer tout de suite, sans attendre que la
  // voiture ait parcouru les 200 m du seuil.
  useEffect(() => {
    if (!position) return
    void rafraichirProches(position.coords.latitude, position.coords.longitude)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponiblesSeulement])

  const traiterPosition = useCallback(
    (pos: GeolocationPosition) => {
      setPosition(pos)
      setErreurGps(null)

      const { latitude, longitude, accuracy } = pos.coords
      const maintenant = Date.now()

      if (vehiculeId && maintenant - dernierEnvoi.current > INTERVALLE_ENVOI_MS) {
        dernierEnvoi.current = maintenant
        void envoyerPosition(vehiculeId, {
          lat: latitude,
          lng: longitude,
          precisionM: accuracy,
        }).catch(() => {
          // Silencieux : une position perdue sera remplacée par la suivante,
          // inutile d'alerter l'utilisateur à chaque hoquet réseau.
        })
      }

      const precedent = dernierCalcul.current
      if (!precedent || distanceM(precedent, [latitude, longitude]) > DISTANCE_RECALCUL_M) {
        void rafraichirProches(latitude, longitude)
      }
    },
    [vehiculeId, rafraichirProches],
  )

  function demarrerSuivi() {
    if (!('geolocation' in navigator)) {
      setErreurGps("Ce navigateur ne fournit pas de géolocalisation.")
      return
    }

    if (!vehiculeId) {
      message.warning('Choisissez d’abord un véhicule.')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      traiterPosition,
      (err) => {
        setErreurGps(
          err.code === err.PERMISSION_DENIED
            ? 'Localisation refusée. Autorisez-la dans les réglages du navigateur pour suivre le véhicule.'
            : `Position indisponible (${err.message}).`,
        )
        setSuiviActif(false)
      },
      // `enableHighAccuracy` demande le GPS plutôt que la position réseau, au
      // prix de la batterie — c'est le compromis attendu pour un suivi de route.
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    setSuiviActif(true)
  }

  function arreterSuivi() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setSuiviActif(false)
  }

  // Le watch survivrait au démontage du composant et continuerait à consommer
  // le GPS en arrière-plan.
  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [])

  const coords = position?.coords
  const positionCarte = coords
    ? { lat: coords.latitude, lng: coords.longitude }
    : vehicule?.position
      ? { lat: vehicule.position.lat, lng: vehicule.position.lng }
      : null

  const plusProche = proches[0] ?? null

  const columns = [
    {
      title: 'Distance',
      dataIndex: 'distanceKm',
      width: 130,
      render: (km: number, _r: BorneProche, index: number) => (
        <div>
          <strong style={{ color: index === 0 ? '#6fe45c' : undefined }}>
            {formatDistance(km)}
          </strong>
          {index === 0 && (
            <div>
              <Tag color="green" style={{ marginTop: 4 }}>
                la plus proche
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Borne',
      dataIndex: 'nom',
      render: (nom: string, r: BorneProche) => (
        <div>
          <strong>{nom}</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {[r.adresse, r.ville].filter(Boolean).join(', ') || '—'}
          </div>
        </div>
      ),
    },
    { title: 'Puissance', dataIndex: 'puissance', render: (v: number) => `${v} kW` },
    {
      title: 'Connecteurs',
      dataIndex: 'connecteurs',
      render: (_: unknown, r: BorneProche) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.connecteurs.length === 0 && '—'}
          {r.connecteurs.map((c) => (
            <Tag key={c.id} color={c.disponible ? 'success' : 'default'}>
              {c.type}
            </Tag>
          ))}
        </div>
      ),
    },
    { title: 'État', dataIndex: 'etat', render: (v: string) => <StatusTag value={v} /> },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            style={{ width: 260 }}
            placeholder="Choisir un véhicule"
            value={vehiculeId}
            onChange={setVehiculeId}
            options={vehicules.map((v) => ({
              label: `${v.marque} ${v.modele} — ${v.immatriculation}`,
              value: v.id,
            }))}
          />
          {suiviActif ? (
            <Button danger icon={<StopOutlined />} onClick={arreterSuivi}>
              Arrêter le suivi
            </Button>
          ) : (
            <Button type="primary" icon={<AimOutlined />} onClick={demarrerSuivi}>
              Démarrer le suivi
            </Button>
          )}
          <Tooltip title="N'afficher que les bornes où l'on peut brancher maintenant">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Switch
                size="small"
                checked={disponiblesSeulement}
                onChange={setDisponiblesSeulement}
              />
              Bornes disponibles seulement
            </span>
          </Tooltip>
        </div>
      </div>

      {erreurGps && (
        <Alert type="warning" showIcon message={erreurGps} style={{ marginBottom: 16 }} />
      )}

      {!suiviActif && !positionCarte && !erreurGps && (
        <Alert
          type="info"
          showIcon
          message="Démarrez le suivi pour afficher la position de votre véhicule."
          description="Le navigateur vous demandera l'autorisation d'accéder à votre localisation. La position sert à situer la voiture et à classer les bornes autour d'elle."
          style={{ marginBottom: 16 }}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <StatCard
          icon={<ThunderboltOutlined />}
          label="Borne la plus proche"
          value={plusProche ? formatDistance(plusProche.distanceKm) : '—'}
          hint={plusProche ? plusProche.nom : 'En attente de position'}
        />
        <StatCard
          icon={<EnvironmentOutlined />}
          label="Position du véhicule"
          value={
            positionCarte
              ? `${positionCarte.lat.toFixed(5)}, ${positionCarte.lng.toFixed(5)}`
              : '—'
          }
          hint={
            coords
              ? `Précision ~${Math.round(coords.accuracy)} m`
              : vehicule?.position?.majLe
                ? `Dernier point ${dayjs(vehicule.position.majLe).format('DD/MM HH:mm')}`
                : 'Aucune position connue'
          }
        />
        <StatCard
          icon={<AimOutlined />}
          label="Suivi"
          value={suiviActif ? 'En cours' : 'Arrêté'}
          hint={
            position
              ? `Mis à jour ${dayjs(position.timestamp).format('HH:mm:ss')}`
              : 'Aucun point reçu'
          }
        />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h3>Ma voiture et les bornes autour</h3>
        </div>
        <BornesMap
          bornes={proches}
          height={420}
          zoom={12}
          showLegend
          vehicule={
            positionCarte && vehicule
              ? {
                  lat: positionCarte.lat,
                  lng: positionCarte.lng,
                  label: `${vehicule.marque} ${vehicule.modele}`,
                  precisionM: coords?.accuracy ?? vehicule.position?.precisionM ?? null,
                }
              : null
          }
          borneProcheId={plusProche?.id ?? null}
        />
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>Bornes les plus proches</h3>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={proches}
          pagination={false}
          locale={{
            emptyText: positionCarte
              ? 'Aucune borne ne correspond au filtre.'
              : 'Démarrez le suivi pour classer les bornes autour de vous.',
          }}
        />
      </div>
    </div>
  )
}

export default ClientSuivi
