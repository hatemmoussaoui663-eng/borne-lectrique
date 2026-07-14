import { useMemo, useState } from 'react'
import { Table, Input, Select, Button, message, Tag } from 'antd'
import { SearchOutlined, PlusOutlined, CreditCardOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { users } from '../../mock/data'
import type { AppUser, UserRole } from '../../types'

const roleOptions: UserRole[] = [
  'Super Administrateur',
  'Exploitant',
  'Opérateur',
  'Technicien',
  'Service Client',
  'Client',
]

function Utilisateurs() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>()

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.nom.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = !roleFilter || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [search, roleFilter])

  const columns = [
    {
      title: 'Utilisateur',
      dataIndex: 'nom',
      render: (_: string, r: AppUser) => (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.email}</div>
        </div>
      ),
    },
    { title: 'Rôle', dataIndex: 'role', render: (v: string) => <Tag color="default">{v}</Tag> },
    {
      title: 'Badge RFID',
      dataIndex: 'badgeRfid',
      render: (v: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CreditCardOutlined /> {v}
        </span>
      ),
    },
    { title: 'Statut', dataIndex: 'statut', render: (v: string) => <StatusTag value={v} /> },
    { title: 'Inscrit le', dataIndex: 'inscrit' },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-toolbar__filters">
          <Input
            className="page-toolbar__search"
            placeholder="Rechercher un utilisateur…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Filtrer par rôle"
            style={{ width: 200 }}
            allowClear
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions.map((r) => ({ label: r, value: r }))}
          />
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info('Formulaire à connecter à l’API Laravel (POST /users).')}
        >
          Ajouter un utilisateur
        </Button>
      </div>

      <div className="panel">
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} />
      </div>
    </div>
  )
}

export default Utilisateurs
