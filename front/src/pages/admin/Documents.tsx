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
  getDestinatairesPossibles,
  uploadDocument,
  fetchDocumentBlob,
  EVENEMENT_NOUVEAUX_DOCUMENTS,
  signalerDocumentsChanges,
  deleteDocument,
} from '../../api/documents'
import { getBorneOptions, type BorneOption } from '../../api/bornes'
import { useAuth } from '../../context/AuthContext'
import type { DocumentFichier, DocumentType, RoleDestinataire } from '../../types'

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

function estPdf(mime: string): boolean {
  return mime === 'application/pdf'
}

/**
 * Formats que le navigateur affiche lui-même. Word, Excel, DWG et ZIP en sont
 * exclus : faute de visionneuse native, un aperçu se solderait par une fenêtre
 * vide ou un téléchargement déguisé.
 */
function estApercuPossible(mime: string): boolean {
  return estImage(mime) || estPdf(mime)
}

interface FormValues {
  type: DocumentType
  titre: string
  borneId?: string
  dateExpiration?: Dayjs
  roleIds?: string[]
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
  const [apercu, setApercu] = useState<{ url: string; titre: string; mime: string } | null>(null)
  const [destinataires, setDestinataires] = useState<RoleDestinataire[]>([])
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

  // Le layout surveille l'arrivee de nouvelles pieces pour sa pastille ; on
  // se raccroche a sa detection plutot que d'interroger le serveur en double.
  useEffect(() => {
    const recharger = () => void load()
    window.addEventListener(EVENEMENT_NOUVEAUX_DOCUMENTS, recharger)
    return () => window.removeEventListener(EVENEMENT_NOUVEAUX_DOCUMENTS, recharger)
  }, [load])

  useEffect(() => {
    void getDestinatairesPossibles()
      .then(setDestinataires)
      // Sans la liste, le champ reste vide et le document part sans ciblage :
      // visible de tous, jamais l'inverse.
      .catch(() => message.error('Impossible de charger la liste des rôles.'))
  }, [])

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

  /**
   * Le téléchargement a déjà éteint le marqueur côté serveur : on reflète
   * l'état localement plutôt que de recharger toute la liste pour un booléen.
   */
  function marquerLuLocalement(id: string) {
    setDocuments((liste) =>
      liste.map((d) => (d.id === id ? { ...d, nonLu: false } : d)),
    )

    // Le compteur du menu vit dans le layout : il ne se recalculerait qu'a la
    // prochaine navigation sans ce signal.
    signalerDocumentsChanges()
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
      marquerLuLocalement(doc.id)
    } catch {
      message.error('Téléchargement impossible.')
    }
  }

  async function handleApercu(doc: DocumentFichier) {
    try {
      const blob = await fetchDocumentBlob(doc.id)
      // Le type porte par la reponse peut etre generique : on le force a celui
      // enregistre, sinon le navigateur propose un telechargement au lieu
      // d'afficher le PDF dans le cadre.
      const fichier = new Blob([blob], { type: doc.mime })
      setApercu({ url: URL.createObjectURL(fichier), titre: doc.titre, mime: doc.mime })
      marquerLuLocalement(doc.id)
    } catch {
      message.error('Aperçu indisponible.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      // Supprimer une pièce jamais ouverte fait baisser le compteur.
      signalerDocumentsChanges()
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
        roleIds: values.roleIds ?? [],
        fichier,
      })
      setDocuments((prev) => [saved, ...prev])
      setModalOpen(false)
      signalerDocumentsChanges()
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
            {/* Marqueur de nouveauté : rouge et explicite plutôt qu'une simple
                pastille, pour que la raison du signalement soit lisible sans
                survol. Il s'éteint dès que la pièce est ouverte. */}
            {r.nonLu && (
              <Tag color="red" style={{ marginLeft: 8 }}>
                Nouveau
              </Tag>
            )}
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
        title: 'Destinataires',
        dataIndex: 'destinataires',
        render: (roles: RoleDestinataire[]) =>
          roles.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Tous les métiers</span>
          ) : (
            <>
              {roles.map((r) => (
                <Tag key={r.id}>{r.nom}</Tag>
              ))}
            </>
          ),
      },
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
            {estApercuPossible(r.mime) && (
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

          <Form.Item
            label="Destinataires"
            name="roleIds"
            extra="Laisser vide pour rendre le document visible de tous les métiers."
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Tous les métiers"
              options={destinataires.map((r) => ({ label: r.nom, value: r.id }))}
            />
          </Form.Item>

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
        /* Un PDF a besoin de place : à 720 px la visionneuse intégrée réduit
           la page au point de la rendre illisible. */
        width={apercu && estPdf(apercu.mime) ? 960 : 720}
      >
        {apercu &&
          (estPdf(apercu.mime) ? (
            /* Visionneuse native du navigateur plutôt qu'une bibliothèque :
               pas de dépendance à charger, et la pagination, la recherche et
               le zoom viennent gratuitement. */
            <iframe
              src={apercu.url}
              title={apercu.titre}
              style={{ width: '100%', height: '75vh', border: 0 }}
            />
          ) : (
            <Image src={apercu.url} alt={apercu.titre} style={{ width: '100%' }} preview={false} />
          ))}
      </Modal>
    </div>
  )
}

export default Documents
