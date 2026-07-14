import { Table, Tag } from 'antd'
import { vehicules } from '../../mock/data'

const columns = [
  { title: 'Propriétaire', dataIndex: 'proprietaire' },
  {
    title: 'Véhicule',
    dataIndex: 'marque',
    render: (_: string, r: (typeof vehicules)[number]) => `${r.marque} ${r.modele}`,
  },
  { title: 'Immatriculation', dataIndex: 'immatriculation' },
  { title: 'Connecteur', dataIndex: 'connecteur', render: (v: string) => <Tag>{v}</Tag> },
  { title: 'Capacité batterie', dataIndex: 'capaciteKwh', render: (v: number) => `${v} kWh` },
]

function Vehicules() {
  return (
    <div className="panel">
      <Table rowKey="id" columns={columns} dataSource={vehicules} pagination={{ pageSize: 8 }} />
    </div>
  )
}

export default Vehicules
