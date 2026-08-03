import { useEffect, useMemo, useState } from 'react'
import { Table, Input, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { getSessions } from '../../api/sessions'
import { echo } from '../../echo'
import type { ChargeSession, SessionEtat } from '../../types'

const etatOptions: SessionEtat[] = ['En cours', 'En pause', 'Terminée', 'Annulée']

function upsertById(list: ChargeSession[], incoming: ChargeSession): ChargeSession[] {
  const index = list.findIndex((s) => s.id === incoming.id)
  if (index === -1) return [incoming, ...list]
  const next = [...list]
  next[index] = incoming
  return next
}

function Sessions() {
  const [sessions, setSessions] = useState<ChargeSession[]>([])
  const [search, setSearch] = useState('')
  const [etatFilter, setEtatFilter] = useState<SessionEtat | undefined>()

  useEffect(() => {
    void getSessions().then(setSessions)

    const channel = echo.channel('sessions-updates')
    channel.listen('.session.updated', (session: ChargeSession) => {
      setSessions((prev) => upsertById(prev, session))
    })

    return () => {
      echo.leaveChannel('sessions-updates')
    }
  }, [])

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        !search ||
        (s.idTag ?? '').toLowerCase().includes(search.toLowerCase()) ||
        s.borne.toLowerCase().includes(search.toLowerCase())
      const matchesEtat = !etatFilter || s.etat === etatFilter
      return matchesSearch && matchesEtat
    })
  }, [search, etatFilter, sessions])

  const columns = [
    { title: 'Session', dataIndex: 'id' },
    {
      title: 'Utilisateur',
      dataIndex: 'utilisateur',
      render: (_: string | undefined, r: ChargeSession) => r.utilisateur ?? r.idTag ?? '—',
    },
    { title: 'Borne', dataIndex: 'borne' },
    { title: 'Connecteur', dataIndex: 'connecteur' },
    { title: 'Début', dataIndex: 'debut' },
    {
      title: 'Durée',
      dataIndex: 'dureeMin',
      render: (_: number, r: ChargeSession) => `${r.dureeMin} min`,
    },
    {
      title: 'Énergie',
      dataIndex: 'energieKwh',
      render: (v: number) => `${v.toFixed(1)} kWh`,
    },
    {
      title: 'Prix',
      dataIndex: 'prix',
      render: (v: number) => `${v.toFixed(3)} DT`,
    },
    { title: 'État', dataIndex: 'etat', render: (v: string) => <StatusTag value={v} /> },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-toolbar__filters">
          <Input
            className="page-toolbar__search"
            placeholder="Rechercher un badge, une borne…"
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

      <div className="panel">
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} />
      </div>
    </div>
  )
}

export default Sessions
