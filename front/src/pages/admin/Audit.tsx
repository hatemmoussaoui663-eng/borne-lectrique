import { useCallback, useEffect, useMemo, useState } from 'react'
import { Table, Tag, Button, Select, Input, DatePicker, Tooltip, message } from 'antd'
import {
  DownloadOutlined,
  LoginOutlined,
  LogoutOutlined,
  WarningOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { getAuditLogs, exportAuditLogs, type AuditFilters } from '../../api/audit'
import type { AuditAction, AuditChangements, AuditLogEntry } from '../../types'

const { RangePicker } = DatePicker

const ACTIONS: { value: AuditAction; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'connexion', label: 'Connexion', color: 'green', icon: <LoginOutlined /> },
  { value: 'deconnexion', label: 'Déconnexion', color: 'default', icon: <LogoutOutlined /> },
  {
    value: 'connexion_echouee',
    label: 'Connexion échouée',
    color: 'red',
    icon: <WarningOutlined />,
  },
  { value: 'creation', label: 'Création', color: 'blue', icon: <PlusCircleOutlined /> },
  { value: 'modification', label: 'Modification', color: 'gold', icon: <EditOutlined /> },
  { value: 'suppression', label: 'Suppression', color: 'volcano', icon: <DeleteOutlined /> },
]

/** Doit rester aligné sur les libellés de AuditObserver::ENTITES côté serveur. */
const ENTITES = [
  'Borne',
  'Utilisateur',
  'Rôle',
  'Véhicule',
  'Badge RFID',
  'Ticket de maintenance',
  'Tarification',
  'Document',
]

const PAR_PAGE = 25

function actionMeta(action: AuditAction) {
  return ACTIONS.find((a) => a.value === action) ?? ACTIONS[0]
}

/** Une connexion refusée sur un email inconnu n'a jamais eu de compte : ce n'est
 *  pas un compte supprimé, et le signaler comme tel induirait en erreur. */
function compteSupprime(ligne: AuditLogEntry): boolean {
  return !ligne.compteLie && ligne.action !== 'connexion_echouee'
}

/** Rend le diff d'une ligne : soit avant → après, soit l'état complet. */
function DetailChangements({ changements }: { changements: AuditChangements }) {
  const entrees = Object.entries(changements)

  if (entrees.length === 0) {
    return <p style={{ margin: 0, color: 'var(--text-muted)' }}>Aucun détail enregistré.</p>
  }

  return (
    <table className="mini-table" style={{ maxWidth: 720 }}>
      <thead>
        <tr>
          <th>Champ</th>
          <th>Avant</th>
          <th>Après</th>
        </tr>
      </thead>
      <tbody>
        {entrees.map(([champ, valeur]) => {
          const diff = valeur !== null && typeof valeur === 'object'
          return (
            <tr key={champ}>
              <td>
                <strong>{champ}</strong>
              </td>
              <td style={{ color: 'var(--text-muted)' }}>
                {diff ? (valeur.avant ?? '—') : '—'}
              </td>
              <td>{diff ? (valeur.apres ?? '—') : (valeur ?? '—')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Audit() {
  const [lignes, setLignes] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [action, setAction] = useState<AuditAction | undefined>()
  const [entite, setEntite] = useState<string | undefined>()
  const [recherche, setRecherche] = useState('')
  const [periode, setPeriode] = useState<[Dayjs, Dayjs] | null>(null)

  const filtres = useMemo<AuditFilters>(
    () => ({
      action,
      entite,
      recherche: recherche.trim() || undefined,
      du: periode?.[0]?.format('YYYY-MM-DD'),
      au: periode?.[1]?.format('YYYY-MM-DD'),
    }),
    [action, entite, recherche, periode],
  )

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const reponse = await getAuditLogs({ ...filtres, page, parPage: PAR_PAGE })
      setLignes(reponse.data)
      setTotal(reponse.total)
    } catch {
      message.error('Impossible de charger le journal d’audit.')
    } finally {
      setLoading(false)
    }
  }, [filtres, page])

  useEffect(() => {
    void load()
  }, [load])

  // Changer un filtre alors qu'on est page 5 renverrait une page vide : on
  // repart systématiquement de la première.
  useEffect(() => {
    setPage(1)
  }, [action, entite, recherche, periode])

  async function handleExport() {
    try {
      setExporting(true)
      // L'export porte sur les filtres courants, pas seulement la page affichée.
      const blob = await exportAuditLogs(filtres)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `journal-audit-${dayjs().format('YYYY-MM-DD')}.csv`
      lien.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Export impossible.')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
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
    {
      title: 'Utilisateur',
      dataIndex: 'utilisateur',
      render: (nom: string, r: AuditLogEntry) => (
        <div>
          <strong>{nom}</strong>
          {compteSupprime(r) && (
            <Tooltip title="Le compte a été supprimé depuis ; la trace, elle, est conservée.">
              <Tag style={{ marginLeft: 6 }}>compte supprimé</Tag>
            </Tooltip>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.role ?? '—'}</div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 180,
      render: (action: AuditAction) => {
        const meta = actionMeta(action)
        return (
          <Tag color={meta.color} icon={meta.icon}>
            {meta.label}
          </Tag>
        )
      },
    },
    {
      title: 'Objet',
      dataIndex: 'libelle',
      render: (libelle: string, r: AuditLogEntry) => (
        <div>
          {libelle}
          {r.entite && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {r.entite}
              {r.entiteId ? ` #${r.entiteId}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 130,
      render: (ip: string | null) => (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ip ?? '—'}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>
          Traçabilité complète : connexions, créations, modifications et suppressions. Le journal
          est en ajout seul — il ne peut être ni modifié ni vidé depuis l’application.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Actualiser
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => void handleExport()}
            loading={exporting}
          >
            Exporter en CSV
          </Button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select
            allowClear
            placeholder="Toutes les actions"
            style={{ width: 200 }}
            value={action}
            onChange={setAction}
            options={ACTIONS.map((a) => ({ label: a.label, value: a.value }))}
          />
          <Select
            allowClear
            placeholder="Toutes les entités"
            style={{ width: 220 }}
            value={entite}
            onChange={setEntite}
            options={ENTITES.map((e) => ({ label: e, value: e }))}
          />
          <RangePicker
            format="DD/MM/YYYY"
            value={periode}
            onChange={(v) => setPeriode(v as [Dayjs, Dayjs] | null)}
          />
          <Input.Search
            allowClear
            placeholder="Utilisateur ou objet…"
            style={{ width: 260 }}
            onSearch={setRecherche}
          />
        </div>
      </div>

      <div className="panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={lignes}
          loading={loading}
          locale={{ emptyText: 'Aucune entrée dans le journal.' }}
          // Pagination pilotée par le serveur : le journal grossit sans limite,
          // on ne charge que la page consultée.
          pagination={{
            current: page,
            pageSize: PAR_PAGE,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} entrée${t > 1 ? 's' : ''}`,
            onChange: setPage,
          }}
          expandable={{
            expandedRowRender: (r) => <DetailChangements changements={r.changements ?? {}} />,
            rowExpandable: (r) => Boolean(r.changements && Object.keys(r.changements).length > 0),
          }}
        />
      </div>
    </div>
  )
}

export default Audit
