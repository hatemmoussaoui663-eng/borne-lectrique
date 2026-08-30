import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Tabs, Button, Spin, message, Modal, Input, Popconfirm, Dropdown } from 'antd'
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  UnlockOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import Documents from './Documents'
import { apiClient } from '../../api/client'
import { remoteStart, remoteStop, unlockConnector, resetBorne } from '../../api/commands'
import { useAuth } from '../../context/AuthContext'
import { sessions } from '../../mock/data'
import type { Borne, Connecteur } from '../../types'

function commandErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return fallback
}

function ConnectorActions({ borneId, connecteur }: { borneId: string; connecteur: Connecteur }) {
  const { can } = useAuth()
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [idTag, setIdTag] = useState('')
  const [busy, setBusy] = useState(false)
  const connectorId = Number(connecteur.id)
  const canCommand = can('commandes_ocpp', 'full')

  async function handleStart() {
    try {
      setBusy(true)
      await remoteStart(borneId, connectorId, idTag.trim())
      message.success(`Démarrage à distance envoyé au connecteur ${connecteur.id}.`)
      setStartModalOpen(false)
      setIdTag('')
    } catch (error) {
      message.error(commandErrorMessage(error, 'Impossible de démarrer la recharge à distance.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    try {
      setBusy(true)
      await remoteStop(borneId, connectorId)
      message.success(`Arrêt à distance envoyé au connecteur ${connecteur.id}.`)
    } catch (error) {
      message.error(commandErrorMessage(error, "Impossible d'arrêter la recharge à distance."))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    try {
      setBusy(true)
      await unlockConnector(borneId, connectorId)
      message.success(`Déverrouillage envoyé au connecteur ${connecteur.id}.`)
    } catch (error) {
      message.error(commandErrorMessage(error, 'Impossible de déverrouiller le connecteur.'))
    } finally {
      setBusy(false)
    }
  }

  if (!canCommand) {
    return null
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {connecteur.etat === 'Occupée' ? (
        <Popconfirm title="Arrêter cette recharge à distance ?" onConfirm={() => void handleStop()}>
          <Button size="small" icon={<PauseCircleOutlined />} loading={busy}>
            Arrêter
          </Button>
        </Popconfirm>
      ) : (
        <Button size="small" icon={<PlayCircleOutlined />} onClick={() => setStartModalOpen(true)} loading={busy}>
          Démarrer à distance
        </Button>
      )}
      <Popconfirm title="Déverrouiller ce connecteur ?" onConfirm={() => void handleUnlock()}>
        <Button size="small" icon={<UnlockOutlined />} loading={busy}>
          Déverrouiller
        </Button>
      </Popconfirm>

      <Modal
        title={`Démarrer une recharge — connecteur ${connecteur.id}`}
        open={startModalOpen}
        onCancel={() => setStartModalOpen(false)}
        onOk={() => void handleStart()}
        confirmLoading={busy}
        okText="Démarrer"
        cancelText="Annuler"
      >
        <Input
          placeholder="Badge RFID (idTag)"
          value={idTag}
          onChange={(e) => setIdTag(e.target.value)}
        />
      </Modal>
    </div>
  )
}

function BorneDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can, user } = useAuth()
  const canCommand = can('commandes_ocpp', 'full')
  // Reporting/opening a ticket is an Exploitant/Admin action — a Technicien
  // is read-only on tickets except for the statut/pieces of their own.
  const canCreateTicket = can('maintenance', 'full') && user?.role_slug !== 'technicien'
  const canVoirDocuments = can('documents')
  const [borne, setBorne] = useState<Borne | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    const loadBorne = async () => {
      try {
        setLoading(true)
        const { data } = await apiClient.get<Borne>(`/bornes/${id}`)
        setBorne(data)
      } catch {
        message.error('Impossible de charger la borne')
      } finally {
        setLoading(false)
      }
    }

    void loadBorne()
  }, [id])

  async function handleReset(type: 'Soft' | 'Hard') {
    if (!borne) return
    try {
      setResetting(true)
      await resetBorne(borne.id, type)
      message.success(`Redémarrage (${type}) envoyé à la borne.`)
    } catch (error) {
      message.error(commandErrorMessage(error, 'Impossible de redémarrer la borne.'))
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <Spin />
      </div>
    )
  }

  if (!borne) {
    return (
      <div className="panel">
        <p>Borne introuvable.</p>
        <Link to="/dashboard/bornes">Retour à la liste</Link>
      </div>
    )
  }

  const history = sessions.filter((s) => s.borne === borne.nom)

  const resetMenu = {
    items: [
      { key: 'soft', label: 'Redémarrage logiciel (Soft)' },
      { key: 'hard', label: 'Redémarrage matériel (Hard)' },
    ],
    onClick: ({ key }: { key: string }) => void handleReset(key === 'hard' ? 'Hard' : 'Soft'),
  }

  return (
    <div>
      <Link to="/dashboard/bornes" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
        <ArrowLeftOutlined /> Retour aux bornes
      </Link>

      <div className="panel" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, textTransform: 'none' }}>{borne.nom}</h2>
          <p style={{ marginTop: 6, fontSize: 13 }}>
            {borne.reference} · {borne.modele} · {borne.fabricant}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusTag value={borne.etat} />
          {canCommand && (
            <Dropdown menu={resetMenu} trigger={['click']}>
              <Button icon={<ReloadOutlined />} loading={resetting}>
                Redémarrer
              </Button>
            </Dropdown>
          )}
          {canCreateTicket && (
            <Button
              icon={<ToolOutlined />}
              onClick={() => navigate('/dashboard/maintenance', { state: { borneId: borne.id } })}
            >
              Créer un ticket
            </Button>
          )}
        </div>
      </div>

      <Tabs
        items={[
          {
            key: 'infos',
            label: 'Informations',
            children: (
              <div className="panel">
                <dl className="detail-grid">
                  <div><dt>Numéro de série</dt><dd>{borne.numeroSerie}</dd></div>
                  <div><dt>Adresse</dt><dd>{borne.adresse}, {borne.ville}</dd></div>
                  <div><dt>Coordonnées GPS</dt><dd><EnvironmentOutlined /> {borne.lat.toFixed(4)}, {borne.lng.toFixed(4)}</dd></div>
                  <div><dt>Version firmware</dt><dd>{borne.firmware}</dd></div>
                  <div><dt>Version OCPP</dt><dd>{borne.ocpp}</dd></div>
                  <div><dt>Puissance</dt><dd>{borne.puissance} kW</dd></div>
                  <div><dt>Dernier heartbeat</dt><dd>{borne.dernierHeartbeat}</dd></div>
                </dl>
              </div>
            ),
          },
          {
            key: 'connecteurs',
            label: `Connecteurs (${borne.connecteurs.length})`,
            children: (
              <div className="connector-grid">
                {borne.connecteurs.map((c) => (
                  <div className="panel connector-card" key={c.id}>
                    <div className="connector-card__head">
                      <span>{c.type}</span>
                      <StatusTag value={c.etat} />
                    </div>
                    <p style={{ fontSize: 13 }}>Puissance : {c.puissance} kW</p>
                    <p style={{ fontSize: 13 }}>{c.disponible ? 'Disponible pour une session' : 'Non disponible'}</p>
                    <ConnectorActions borneId={borne.id} connecteur={c} />
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'historique',
            label: 'Historique des sessions',
            children: (
              <div className="panel">
                {history.length === 0 ? (
                  <p>Aucune session récente sur cette borne.</p>
                ) : (
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>Connecteur</th>
                        <th>Début</th>
                        <th>Durée</th>
                        <th>Énergie</th>
                        <th>État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((s) => (
                        <tr key={s.id}>
                          <td>{s.utilisateur}</td>
                          <td>{s.connecteur}</td>
                          <td>{s.debut}</td>
                          <td>{s.dureeMin} min</td>
                          <td>{s.energieKwh.toFixed(1)} kWh</td>
                          <td><StatusTag value={s.etat} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ),
          },
          ...(canVoirDocuments
            ? [
                {
                  key: 'documents',
                  label: 'Documents',
                  children: <Documents borneId={borne.id} compact />,
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}

export default BorneDetail
