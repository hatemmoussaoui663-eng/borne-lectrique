import { useCallback, useEffect, useState } from 'react'
import {
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Popconfirm,
  Tooltip,
  message,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  UploadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  RollbackOutlined,
  InboxOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getFirmwares,
  uploadFirmware,
  deleteFirmware,
  deployerFirmware,
  getDeployments,
  rollbackDeployment,
  type ResultatDeploiement,
} from '../../api/firmware'
import { getBorneOptions, type BorneOption } from '../../api/bornes'
import { useAuth } from '../../context/AuthContext'
import type { Firmware, FirmwareDeployment, FirmwareStatut } from '../../types'

const STATUTS: Record<FirmwareStatut, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'default' },
  telechargement: { label: 'Téléchargement', color: 'processing' },
  telecharge: { label: 'Téléchargé', color: 'cyan' },
  installation: { label: 'Installation', color: 'processing' },
  installe: { label: 'Installé', color: 'green' },
  echec: { label: 'Échec', color: 'red' },
}

const EXTENSIONS_ACCEPTEES = '.bin,.hex,.img,.tar,.gz,.zip,.fw'
const TAILLE_MAX_MO = 200

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

interface UploadValues {
  version: string
  fabricant?: string
  modele?: string
  notes?: string
  fichier?: UploadFile[]
}

function FirmwarePage() {
  const { can } = useAuth()
  const canWrite = can('firmware', 'full')

  const [firmwares, setFirmwares] = useState<Firmware[]>([])
  const [deployments, setDeployments] = useState<FirmwareDeployment[]>([])
  const [bornes, setBornes] = useState<BorneOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [cible, setCible] = useState<Firmware | null>(null)
  const [bornesChoisies, setBornesChoisies] = useState<string[]>([])
  const [form] = Form.useForm<UploadValues>()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [f, d] = await Promise.all([getFirmwares(), getDeployments()])
      setFirmwares(f)
      setDeployments(d)
    } catch {
      message.error('Impossible de charger les firmwares depuis le backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void getBorneOptions()
      .then(setBornes)
      .catch(() => message.error('Impossible de charger la liste des bornes.'))
  }, [load])

  /** Un déploiement porte sur plusieurs bornes : le détail par borne compte
   *  autant que le résumé, une seule peut avoir échoué. */
  function annoncerResultats(resume: string, resultats: ResultatDeploiement[]) {
    const echecs = resultats.filter((r) => !r.succes)

    if (echecs.length === 0) {
      message.success(resume)
      return
    }

    Modal.warning({
      title: resume,
      content: (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {echecs.map((r) => (
            <li key={r.borne}>
              <strong>{r.borne}</strong> : {r.message}
            </li>
          ))}
        </ul>
      ),
    })
  }

  async function handleUpload(values: UploadValues) {
    const fichier = values.fichier?.[0]?.originFileObj
    if (!fichier) {
      message.error('Sélectionnez un binaire à téléverser.')
      return
    }

    try {
      setSaving(true)
      const saved = await uploadFirmware({
        version: values.version,
        fabricant: values.fabricant ?? null,
        modele: values.modele ?? null,
        notes: values.notes ?? null,
        fichier,
      })
      setFirmwares((prev) => [saved, ...prev])
      setUploadOpen(false)
      message.success(`Firmware ${saved.version} ajouté à la bibliothèque.`)
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        `Téléversement impossible (format non accepté ou fichier de plus de ${TAILLE_MAX_MO} Mo).`
      message.error(detail)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFirmware(id)
      setFirmwares((prev) => prev.filter((f) => f.id !== id))
      message.success('Firmware supprimé de la bibliothèque.')
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Suppression impossible.'
      message.error(detail)
    }
  }

  async function handleDeployer() {
    if (!cible || bornesChoisies.length === 0) return

    try {
      setSaving(true)
      const reponse = await deployerFirmware(cible.id, bornesChoisies)
      annoncerResultats(reponse.message, reponse.resultats)
      setCible(null)
      setBornesChoisies([])
      await load()
    } catch {
      message.error('Déploiement impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRollback(deployment: FirmwareDeployment) {
    try {
      const reponse = await rollbackDeployment(deployment.id)
      annoncerResultats(reponse.message, reponse.resultats)
      await load()
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Retour arrière impossible.'
      message.error(detail)
    }
  }

  const colonnesBibliotheque = [
    {
      title: 'Version',
      dataIndex: 'version',
      render: (version: string, r: Firmware) => (
        <div>
          <strong>{version}</strong>
          {r.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.notes}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Compatibilité',
      dataIndex: 'fabricant',
      render: (_: unknown, r: Firmware) =>
        r.fabricant || r.modele ? (
          <span>
            {[r.fabricant, r.modele].filter(Boolean).join(' ')}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Toutes les bornes</span>
        ),
    },
    {
      title: 'Binaire',
      dataIndex: 'nomFichier',
      render: (nom: string, r: Firmware) => (
        <div>
          {nom}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTaille(r.taille)}</div>
        </div>
      ),
    },
    {
      title: 'SHA-256',
      dataIndex: 'checksum',
      render: (checksum: string) => (
        <Tooltip title={checksum}>
          <code style={{ fontSize: 12 }}>{checksum.slice(0, 12)}…</code>
        </Tooltip>
      ),
    },
    {
      title: 'Déploiements',
      dataIndex: 'deploiements',
      width: 120,
      render: (n: number | null) => n ?? 0,
    },
    {
      title: 'Ajouté',
      dataIndex: 'ajouteLe',
      render: (date: string, r: Firmware) => (
        <div style={{ fontSize: 12 }}>
          {dayjs(date).format('DD/MM/YYYY')}
          <div style={{ color: 'var(--text-muted)' }}>{r.ajoutePar ?? '—'}</div>
        </div>
      ),
    },
    ...(canWrite
      ? [
          {
            title: '',
            dataIndex: 'actions',
            render: (_: unknown, r: Firmware) => (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={() => setCible(r)}
                >
                  Déployer
                </Button>
                <Popconfirm
                  title="Supprimer ce firmware ?"
                  description="Le binaire sera effacé ; l'historique des déploiements est conservé."
                  onConfirm={() => void handleDelete(r.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Supprimer
                  </Button>
                </Popconfirm>
              </div>
            ),
          },
        ]
      : []),
  ]

  const colonnesHistorique = [
    {
      title: 'Date',
      dataIndex: 'date',
      width: 150,
      render: (date: string) => (
        <div style={{ fontSize: 12 }}>
          {dayjs(date).format('DD/MM/YYYY')}
          <div style={{ color: 'var(--text-muted)' }}>{dayjs(date).format('HH:mm:ss')}</div>
        </div>
      ),
    },
    { title: 'Borne', dataIndex: 'borne', render: (b: string | null) => b ?? '—' },
    {
      title: 'Version',
      dataIndex: 'version',
      render: (version: string, r: FirmwareDeployment) => (
        <div>
          <strong>{version}</strong>
          {r.estRollback && (
            <Tag color="purple" style={{ marginLeft: 6 }}>
              rollback
            </Tag>
          )}
          {r.versionPrecedente && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              depuis {r.versionPrecedente}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (statut: FirmwareStatut, r: FirmwareDeployment) => (
        <div>
          <Tag color={STATUTS[statut].color}>{STATUTS[statut].label}</Tag>
          {r.ocppStatus && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>OCPP : {r.ocppStatus}</div>
          )}
          {r.message && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.message}</div>}
        </div>
      ),
    },
    { title: 'Demandé par', dataIndex: 'demandePar', render: (v: string | null) => v ?? '—' },
    ...(canWrite
      ? [
          {
            title: '',
            dataIndex: 'actions',
            render: (_: unknown, r: FirmwareDeployment) =>
              r.rollbackPossible ? (
                <Popconfirm
                  title={`Revenir à ${r.versionPrecedente} ?`}
                  description="Une nouvelle mise à jour sera envoyée à la borne."
                  onConfirm={() => void handleRollback(r)}
                >
                  <Button size="small" icon={<RollbackOutlined />}>
                    Revenir à {r.versionPrecedente}
                  </Button>
                </Popconfirm>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>
          Bibliothèque de firmwares et déploiement à distance via OCPP&nbsp;<code>UpdateFirmware</code>.
          La borne télécharge le binaire depuis un lien signé et temporaire.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Actualiser
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => {
                form.resetFields()
                setUploadOpen(true)
              }}
            >
              Téléverser un firmware
            </Button>
          )}
        </div>
      </div>

      <Tabs
        items={[
          {
            key: 'bibliotheque',
            label: `Bibliothèque (${firmwares.length})`,
            children: (
              <div className="panel">
                <Table
                  rowKey="id"
                  columns={colonnesBibliotheque}
                  dataSource={firmwares}
                  loading={loading}
                  pagination={{ pageSize: 8 }}
                  locale={{ emptyText: 'Aucun firmware en bibliothèque.' }}
                />
              </div>
            ),
          },
          {
            key: 'historique',
            label: `Historique des déploiements (${deployments.length})`,
            children: (
              <div className="panel">
                <Table
                  rowKey="id"
                  columns={colonnesHistorique}
                  dataSource={deployments}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: 'Aucun déploiement.' }}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Téléverser un firmware"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Téléverser"
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => void handleUpload(v)}>
          <Form.Item
            label="Version"
            name="version"
            rules={[{ required: true, message: 'La version est requise' }]}
          >
            <Input placeholder="1.4.2" />
          </Form.Item>
          <Form.Item
            label="Fabricant"
            name="fabricant"
            extra="Laisser vide pour un firmware applicable à toutes les bornes."
          >
            <Input placeholder="Schneider, ABB…" />
          </Form.Item>
          <Form.Item label="Modèle" name="modele">
            <Input placeholder="EVlink Pro AC…" />
          </Form.Item>
          <Form.Item label="Notes de version" name="notes">
            <Input.TextArea rows={3} placeholder="Correctifs, nouveautés…" />
          </Form.Item>
          <Form.Item
            label="Binaire"
            name="fichier"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: 'Sélectionnez un binaire' }]}
          >
            <Upload.Dragger maxCount={1} accept={EXTENSIONS_ACCEPTEES} beforeUpload={() => false}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Cliquez ou déposez le binaire ici</p>
              <p className="ant-upload-hint">
                .bin, .hex, .img, .tar, .gz, .zip ou .fw — {TAILLE_MAX_MO} Mo maximum.
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={cible ? `Déployer le firmware ${cible.version}` : ''}
        open={Boolean(cible)}
        onCancel={() => {
          setCible(null)
          setBornesChoisies([])
        }}
        onOk={() => void handleDeployer()}
        confirmLoading={saving}
        okText="Envoyer la mise à jour"
        okButtonProps={{ disabled: bornesChoisies.length === 0 }}
        cancelText="Annuler"
      >
        <p style={{ marginTop: 0 }}>
          Chaque borne sélectionnée recevra un ordre <code>UpdateFirmware</code>. Une borne déjà
          en cours de mise à jour sera signalée sans être interrompue.
        </p>
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="Choisir les bornes à mettre à jour"
          value={bornesChoisies}
          onChange={setBornesChoisies}
          options={bornes.map((b) => ({ label: b.nom, value: b.id }))}
        />
      </Modal>
    </div>
  )
}

export default FirmwarePage
