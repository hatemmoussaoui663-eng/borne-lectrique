import { useEffect, useMemo, useState } from 'react'
import { Table, Input, Select, message, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import BornesMap from '../../components/admin/BornesMap'
import { apiClient } from '../../api/client'
import { echo } from '../../echo'
import type { Borne, BorneEtat } from '../../types'

const etatOptions: BorneEtat[] = ['Disponible', 'Occupée', 'Maintenance', 'Déconnectée', 'Défaut']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBorne(item: any): Borne {
  return {
    id: String(item.id ?? ''),
    nom: item.nom ?? item.name ?? '',
    reference: item.reference ?? '',
    numeroSerie: item.numeroSerie ?? '',
    modele: item.modele ?? '',
    fabricant: item.fabricant ?? '',
    adresse: item.adresse ?? '',
    ville: item.ville ?? '',
    lat: Number(item.lat ?? 0) || 0,
    lng: Number(item.lng ?? 0) || 0,
    firmware: item.firmware ?? '',
    ocpp: item.ocpp ?? '1.6',
    puissance: Number(item.puissance ?? 22) || 22,
    etat: (item.etat ?? 'Déconnectée') as BorneEtat,
    dernierHeartbeat: item.dernierHeartbeat ?? '',
    connecteurs: item.connecteurs ?? [],
  }
}

function upsertById(list: Borne[], incoming: Borne): Borne[] {
  const index = list.findIndex((b) => b.id === incoming.id)
  if (index === -1) return [incoming, ...list]
  const next = [...list]
  next[index] = incoming
  return next
}

function ClientBornes() {
  const [bornes, setBornes] = useState<Borne[]>([])
  const [search, setSearch] = useState('')
  const [etatFilter, setEtatFilter] = useState<BorneEtat | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const { data } = await apiClient.get('/bornes')
        setBornes((data ?? []).map(normalizeBorne))
      } catch {
        message.error('Impossible de charger les bornes.')
      } finally {
        setLoading(false)
      }
    }

    void load()

    const channel = echo.channel('bornes-updates')
    channel.listen('.borne.updated', (payload: unknown) => {
      setBornes((current) => upsertById(current, normalizeBorne(payload)))
    })

    return () => {
      echo.leaveChannel('bornes-updates')
    }
  }, [])

  const filtered = useMemo(() => {
    return bornes.filter((b) => {
      const matchesSearch =
        !search ||
        b.nom.toLowerCase().includes(search.toLowerCase()) ||
        b.ville.toLowerCase().includes(search.toLowerCase())
      const matchesEtat = !etatFilter || b.etat === etatFilter
      return matchesSearch && matchesEtat
    })
  }, [bornes, search, etatFilter])

  const columns = [
    {
      title: 'Borne',
      dataIndex: 'nom',
      render: (_: string, r: Borne) => (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.ville}</div>
        </div>
      ),
    },
    { title: 'Adresse', dataIndex: 'adresse', render: (v: string) => v || '—' },
    { title: 'Puissance', dataIndex: 'puissance', render: (v: number) => `${v} kW` },
    {
      title: 'Connecteurs',
      dataIndex: 'connecteurs',
      render: (_: unknown, r: Borne) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.connecteurs.length === 0 && '—'}
          {r.connecteurs.map((c) => (
            <Tag key={c.id} color={c.disponible ? 'success' : 'default'}>
              {c.type} · {c.etat}
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
        <div className="page-toolbar__filters">
          <Input
            className="page-toolbar__search"
            placeholder="Rechercher une borne, une ville…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Filtrer par état"
            style={{ width: 180 }}
            allowClear
            value={etatFilter}
            onChange={setEtatFilter}
            options={etatOptions.map((e) => ({ label: e, value: e }))}
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h3>Carte du réseau ({filtered.length} borne{filtered.length > 1 ? 's' : ''})</h3>
        </div>
        <BornesMap bornes={filtered} height={380} />
      </div>

      <div className="panel">
        <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 8 }} />
      </div>
    </div>
  )
}

export default ClientBornes
