import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  Popconfirm,
  message,
  Image,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  PlusOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  InboxOutlined,
  ReadOutlined,
  PictureOutlined,
  FileProtectOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  getDocuments,
  uploadDocument,
  fetchDocumentBlob,
  deleteDocument,
} from '../../api/documents'
import { getBorneOptions, type BorneOption } from '../../api/bornes'
import { useAuth } from '../../context/AuthContext'
import type { DocumentFichier, DocumentType } from '../../types'

/** Les cinq natures du Module 16, dans l'ordre où le cahier des charges les liste. */
const TYPES: { value: DocumentType; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'notice', label: 'Notice', color: 'blue', icon: <ReadOutlined /> },
  { value: 'photo', label: 'Photo', color: 'magenta', icon: <PictureOutlined /> },
  { value: 'contrat', label: 'Contrat', color: 'gold', icon: <FileProtectOutlined /> },
  { value: 'plan', label: 'Plan', color: 'geekblue', icon: <ApartmentOutlined /> },
  { value: 'garantie', label: 'Garantie', color: 'green', icon: <SafetyCertificateOutlined /> },
]

/** Seuls un contrat et une garantie portent une échéance — même règle que côté serveur. */
const TYPES_AVEC_ECHEANCE: DocumentType[] = ['contrat', 'garantie']

const EXTENSIONS_ACCEPTEES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.dwg,.zip'
const TAILLE_MAX_MO = 20

function typeMeta(type: DocumentType) {
  return TYPES.find((t) => t.value === type) ?? TYPES[0]
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function estImage(mime: string): boolean {
  return mime.startsWith('image/')
}

interface FormValues {
  type: DocumentType
  titre: string
  borneId?: string
  dateExpiration?: Dayjs
  fichier?: UploadFile[]
}

interface DocumentsProps {
  /** Restreint la vue aux pièces d'une borne (onglet du détail borne). */
  borneId?: string
  /** Masque les filtres et l'intitulé de page quand la vue est intégrée ailleurs. */
  compact?: boolean
}

function Documents({ borneId, compact = false }: DocumentsProps) {
  const { can } = useAuth()
  const canWrite = can('documents', 'full')

  const [documents, setDocuments] = useState<DocumentFichier[]>([])
  const [bornes, setBornes] = useState<BorneOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreType, setFiltreType] = useState<DocumentType | undefined>()
  const [filtreBorne, setFiltreBorne] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apercu, setApercu] = useState<{ url: string; titre: string } | null>(null)
  const [form] = Form.useForm<FormValues>()
  const typeChoisi = Form.useWatch('type', form)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setDocuments(await getDocuments({ borneId: borneId ?? filtreBorne, type: filtreType }))
    } catch {
      message.error('Impossible de charger les documents depuis le backend.')
    } finally {
      setLoading(false)
    }
  }, [borneId, filtreBorne, filtreType])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // Sur l'onglet d'une borne la cible est déjà connue : ni filtre ni sélecteur
    // à alimenter, donc pas d'appel réseau supplémentaire.
    if (borneId) return
    void getBorneOptions()
      .then(setBornes)
      .catch(() => message.error('Impossible de charger la liste des bornes.'))
  }, [borneId])

  // Un aperçu est une URL objet : sans révocation, chaque ouverture laisserait
  // le fichier en mémoire jusqu'au rechargement de la page.
  useEffect(() => {
    return () => {
      if (apercu) URL.revokeObjectURL(apercu.url)
    }
  }, [apercu])

  function openCreate() {
    form.resetFields()
    form.setFieldsValue({ type: 'notice', borneId })
    setModalOpen(true)
  }

  async function handleDownload(doc: DocumentFichier) {
    try {
      const blob = await fetchDocumentBlob(doc.id)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = doc.nomFichier
      lien.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Téléchargement impossible.')
    }
  }

  async function handleApercu(doc: DocumentFichier) {
    try {
      const blob = await fetchDocumentBlob(doc.id)
      setApercu({ url: URL.createObjectURL(blob), titre: doc.titre })
    } catch {
      message.error('Aperçu indisponible.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      message.success('Document supprimé.')
    } catch {
      message.error('Suppression impossible.')
    }
  }

  async function handleSave(values: FormValues) {
    const fichier = values.fichier?.[0]?.originFileObj
    if (!fichier) {
      message.error('Sélectionnez un fichier à téléverser.')
      return
    }

    try {
      setSaving(true)
      const saved = await uploadDocument({
        borneId: values.borneId ?? null,
        type: values.type,
        titre: values.titre,
        dateExpiration: values.dateExpiration?.format('YYYY-MM-DD') ?? null,
        fichier,
      })
      setDocuments((prev) => [saved, ...prev])
      setModalOpen(false)
      message.success('Document ajouté.')
    } catch {
      message.error(
        `Téléversement impossible (format non accepté ou fichier de plus de ${TAILLE_MAX_MO} Mo).`,
      )
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        title: 'Type',
        dataIndex: 'type',
        width: 130,
        render: (type: DocumentType) => {
          const meta = typeMeta(type)
          return (
            <Tag color={meta.color} icon={meta.icon}>
              {meta.label}
            </Tag>
          )
        },
      },
      {
        title: 'Titre',
        dataIndex: 'titre',
        render: (titre: string, r: DocumentFichier) => (
          <div>
            <strong>{titre}</strong>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {r.nomFichier} · {formatTaille(r.taille)}
            </div>
          </div>
        ),
      },
      ...(borneId
        ? []
        : [
            {
              title: 'Borne',
              dataIndex: 'borne',
              render: (borne: string | null) =>
                borne ?? <span style={{ color: 'var(--text-muted)' }}>Document général</span>,
            },
          ]),
      {
        title: 'Échéance',
        dataIndex: 'dateExpiration',
        render: (date: string | null, r: DocumentFichier) => {
          if (!date) return <span style={{ color: 'var(--text-muted)' }}>—</span>
          return (
            <span>
              {dayjs(date).format('DD/MM/YYYY')} {r.expire && <Tag color="red">Expiré</Tag>}
            </span>
          )
        },
      },
      {
        title: 'Ajouté',
        dataIndex: 'ajouteLe',
        render: (date: string, r: DocumentFichier) => (
          <div style={{ fontSize: 12 }}>
            {dayjs(date).format('DD/MM/YYYY')}
            <div style={{ color: 'var(--text-muted)' }}>{r.ajoutePar ?? '—'}</div>
          </div>
        ),
      },
      {
        title: '',
        dataIndex: 'actions',
        render: (_: unknown, r: DocumentFichier) => (
          <div style={{ display: 'flex', gap: 8 }}>
            {estImage(r.mime) && (
              <Button size="small" icon={<EyeOutlined />} onClick={() => void handleApercu(r)}>
                Aperçu
              </Button>
            )}
            <Button size="small" icon={<DownloadOutlined />} onClick={() => void handleDownload(r)}>
              Télécharger
            </Button>
            {canWrite && (
              <Popconfirm
                title="Supprimer ce document ?"
                description="Le fichier sera effacé du serveur."
                onConfirm={() => void handleDelete(r.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  Supprimer
                </Button>
              </Popconfirm>
            )}
          </div>
        ),
      },
    ],
    [borneId, canWrite],
  )

  return (
    <div>
      <div className="page-toolbar">
        {!compact && (
          <p style={{ margin: 0 }}>
            Notices, photos, contrats, plans et garanties rattachés aux bornes.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!compact && (
            <>
              <Select
                allowClear
                placeholder="Tous les types"
                style={{ width: 180 }}
                value={filtreType}
                onChange={setFiltreType}
                options={TYPES.map((t) => ({ label: t.label, value: t.value }))}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Toutes les bornes"
                style={{ width: 220 }}
                value={filtreBorne}
                onChange={setFiltreBorne}
                options={bornes.map((b) => ({ label: b.nom, value: b.id }))}
              />
            </>
          )}
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Ajouter un document
            </Button>
          )}
        </div>
      </div>

      <div className="panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={documents}
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'Aucun document.' }}
        />
      </div>

      <Modal
        title="Ajouter un document"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Téléverser"
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)}>
          <Form.Item label="Type" name="type" rules={[{ required: true }]}>
            <Select options={TYPES.map((t) => ({ label: t.label, value: t.value }))} />
          </Form.Item>

          <Form.Item
            label="Titre"
            name="titre"
            rules={[{ required: true, message: 'Le titre est requis' }]}
          >
            <Input placeholder="Notice d’installation, contrat de maintenance…" />
          </Form.Item>

          {!borneId && (
            <Form.Item
              label="Borne"
              name="borneId"
              extra="Laisser vide pour un document valable sur tout le réseau."
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Document général"
                options={bornes.map((b) => ({ label: b.nom, value: b.id }))}
              />
            </Form.Item>
          )}

          {TYPES_AVEC_ECHEANCE.includes(typeChoisi) && (
            <Form.Item label="Échéance" name="dateExpiration">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          )}

          <Form.Item
            label="Fichier"
            name="fichier"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: 'Sélectionnez un fichier' }]}
          >
            <Upload.Dragger
              maxCount={1}
              accept={EXTENSIONS_ACCEPTEES}
              // `false` retient le fichier côté client : c'est le formulaire qui
              // l'envoie, en même temps que le titre et le type.
              beforeUpload={() => false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Cliquez ou déposez un fichier ici</p>
              <p className="ant-upload-hint">
                PDF, image, Word, Excel, DWG ou ZIP — {TAILLE_MAX_MO} Mo maximum.
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={apercu?.titre}
        open={Boolean(apercu)}
        onCancel={() => setApercu(null)}
        footer={null}
        width={720}
      >
        {apercu && (
          <Image src={apercu.url} alt={apercu.titre} style={{ width: '100%' }} preview={false} />
        )}
      </Modal>
    </div>
  )
}

export default Documents
