import { useCallback, useEffect, useState } from 'react'
import { Table, Select, Tag, Tooltip, message } from 'antd'
import { CarOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { getMySessions, getMyVehicules, affecterVehiculeSession } from '../../api/me'
import type { ChargeSession, Vehicule } from '../../types'

function ClientHistorique() {
  const [sessions, setSessions] = useState<ChargeSession[]>([])
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [filtreVehicule, setFiltreVehicule] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [s, v] = await Promise.all([getMySessions(filtreVehicule), getMyVehicules()])
      setSessions(s)
      setVehicules(v)
    } catch {
      message.error('Impossible de charger votre historique de recharge.')
    } finally {
      setLoading(false)
    }
  }, [filtreVehicule])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAffecter(session: ChargeSession, vehiculeId: string | null) {
    try {
      const maj = await affecterVehiculeSession(session.id, vehiculeId)
      setSessions((prev) => prev.map((s) => (s.id === maj.id ? { ...s, ...maj } : s)))
      // Les cumuls par véhicule changent : il faut les relire.
      setVehicules(await getMyVehicules())
      message.success(
        vehiculeId ? 'Véhicule associé à cette recharge.' : 'Véhicule retiré de cette recharge.',
      )
    } catch {
      message.error('Association impossible.')
    }
  }

  const columns = [
    { title: 'Borne', dataIndex: 'borne' },
    {
      title: 'Véhicule',
      dataIndex: 'vehicule',
      width: 220,
      render: (_: unknown, r: ChargeSession) => (
        // La borne ne sait pas quelle voiture était branchée : c'est au client
        // de le renseigner, directement depuis la ligne concernée.
        <Select
          size="small"
          allowClear
          style={{ width: 200 }}
          placeholder={
            <span style={{ color: 'var(--text-muted)' }}>
              <CarOutlined /> Associer un véhicule
            </span>
          }
          value={r.vehiculeId ?? undefined}
          onChange={(v) => void handleAffecter(r, v ?? null)}
          options={vehicules.map((v) => ({
            label: `${v.marque} ${v.modele}`,
            value: v.id,
          }))}
        />
      ),
    },
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

  const sansVehicule = sessions.filter((s) => !s.vehiculeId).length

  return (
    <div>
      <div className="page-toolbar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            allowClear
            style={{ width: 260 }}
            placeholder="Toutes mes voitures"
            value={filtreVehicule}
            onChange={setFiltreVehicule}
            options={vehicules.map((v) => ({
              label: `${v.marque} ${v.modele} — ${v.recharges?.nombre ?? 0} recharge${
                (v.recharges?.nombre ?? 0) > 1 ? 's' : ''
              }`,
              value: v.id,
            }))}
          />
          {sansVehicule > 0 && (
            <Tooltip title="La borne ne transmet pas quelle voiture est branchée. Choisissez-la dans la colonne « Véhicule » pour compléter l'historique de ce véhicule.">
              <Tag color="gold">
                {sansVehicule} recharge{sansVehicule > 1 ? 's' : ''} sans véhicule
              </Tag>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={sessions}
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'Aucune recharge pour ce filtre.' }}
        />
      </div>
    </div>
  )
}

export default ClientHistorique
