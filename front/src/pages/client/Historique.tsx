import { useEffect, useState } from 'react'
import { Table, message } from 'antd'
import StatusTag from '../../components/admin/StatusTag'
import { getMySessions } from '../../api/me'
import type { ChargeSession } from '../../types'

function ClientHistorique() {
  const [sessions, setSessions] = useState<ChargeSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setSessions(await getMySessions())
      } catch {
        message.error('Impossible de charger votre historique de recharge.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const columns = [
    { title: 'Borne', dataIndex: 'borne' },
    { title: 'Connecteur', dataIndex: 'connecteur' },
    { title: 'Début', dataIndex: 'debut' },
    { title: 'Fin', dataIndex: 'fin', render: (v: string | null) => v ?? '—' },
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
    <div className="panel">
      <Table rowKey="id" columns={columns} dataSource={sessions} loading={loading} pagination={{ pageSize: 8 }} />
    </div>
  )
}

export default ClientHistorique
