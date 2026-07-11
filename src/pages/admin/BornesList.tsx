import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Table, Input, Select, Button, message } from 'antd'
import { SearchOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import BornesMap from '../../components/admin/BornesMap'
import { bornes } from '../../mock/data'
import type { Borne, BorneEtat } from '../../types'

const etatOptions: BorneEtat[] = [
  'Disponible',
  'Occupée',
  'Hors service',
  'Maintenance',
  'Déconnectée',
  'Défaut',
]

function BornesList() {
  const [search, setSearch] = useState('')
  const [etatFilter, setEtatFilter] = useState<BorneEtat | undefined>()

  const filtered = useMemo(() => {
    return bornes.filter((b) => {
      const matchesSearch =
        !search ||
        b.nom.toLowerCase().includes(search.toLowerCase()) ||
        b.ville.toLowerCase().includes(search.toLowerCase())
      const matchesEtat = !etatFilter || b.etat === etatFilter
      return matchesSearch && matchesEtat
    })
  }, [search, etatFilter])

  const columns = [
    {
      title: 'Borne',
      dataIndex: 'nom',
      render: (_: string, record: Borne) => (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{record.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{record.reference}</div>
        </div>
      ),
    },
    {
      title: 'Localisation',
      dataIndex: 'ville',
      render: (_: string, record: Borne) => (
        <div>
          <div>{record.ville}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{record.adresse}</div>
        </div>
      ),
    },
    {
      title: 'Modèle',
      dataIndex: 'modele',
      render: (_: string, record: Borne) => (
        <div>
          <div>{record.modele}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{record.fabricant}</div>
        </div>
      ),
    },
    { title: 'Puissance', dataIndex: 'puissance', render: (v: number) => `${v} kW` },
    {
      title: 'Connecteurs',
      dataIndex: 'connecteurs',
      render: (_: unknown, record: Borne) => `${record.connecteurs.length} (${record.connecteurs.map((c) => c.type).join(', ')})`,
    },
    { title: 'OCPP', dataIndex: 'ocpp' },
    { title: 'État', dataIndex: 'etat', render: (v: string) => <StatusTag value={v} /> },
    { title: 'Heartbeat', dataIndex: 'dernierHeartbeat' },
    {
      title: '',
      dataIndex: 'action',
      render: (_: unknown, record: Borne) => (
        <Link to={`/dashboard/bornes/${record.id}`}>
          <Button size="small" icon={<EyeOutlined />}>
            Détail
          </Button>
        </Link>
      ),
    },
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info('Formulaire à connecter à l’API Laravel (POST /bornes).')}
        >
          Ajouter une borne
        </Button>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h3>Carte du réseau ({filtered.length} borne{filtered.length > 1 ? 's' : ''})</h3>
        </div>
        <BornesMap bornes={filtered} height={380} />
      </div>

      <div className="panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 8 }}
        />
      </div>
    </div>
  )
}

export default BornesList
