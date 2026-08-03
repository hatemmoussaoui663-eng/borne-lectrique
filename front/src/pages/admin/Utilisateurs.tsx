import { useEffect, useMemo, useState } from 'react'
import { Table, Input, Select, Button, message, Tag, Modal } from 'antd'
import { SearchOutlined, PlusOutlined, CreditCardOutlined, IdcardOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { getUsers, updateUserBadge } from '../../api/users'
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
  const [users, setUsers] = useState<AppUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>()
  const [badgeEditUser, setBadgeEditUser] = useState<AppUser | null>(null)
  const [badgeValue, setBadgeValue] = useState('')
  const [savingBadge, setSavingBadge] = useState(false)

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await getUsers()
        setUsers(data)
      } catch {
        message.error('Impossible de charger la liste des utilisateurs depuis le backend.')
      }
    }

    loadUsers()
  }, [])

  function openBadgeEditor(user: AppUser) {
    setBadgeEditUser(user)
    setBadgeValue(user.badgeRfid)
  }

  async function saveBadge() {
    if (!badgeEditUser) return
    try {
      setSavingBadge(true)
      const updated = await updateUserBadge(badgeEditUser.id, badgeValue.trim())
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      setBadgeEditUser(null)
      message.success('Badge RFID mis à jour.')
    } catch {
      message.error('Impossible de mettre à jour le badge (déjà utilisé par un autre utilisateur ?).')
    } finally {
      setSavingBadge(false)
    }
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const label = (u.nom || '').toLowerCase()
      const matchesSearch =
        !search ||
        label.includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = !roleFilter || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [search, roleFilter, users])

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
      title: 'Téléphone',
      dataIndex: 'phone',
      render: (v: string | undefined) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CreditCardOutlined /> {v || '-'}
        </span>
      ),
    },
    {
      title: 'Badge RFID',
      dataIndex: 'badgeRfid',
      render: (v: string, r: AppUser) => (
        <Button
          size="small"
          type="text"
          icon={<IdcardOutlined />}
          onClick={() => openBadgeEditor(r)}
          style={{ color: v ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          {v || 'Associer un badge'}
        </Button>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (value: 'Actif' | 'Bloqué' | 'Expiré') => (
        <StatusTag value={value} />
      ),
    },
    {
      title: 'Inscrit le',
      dataIndex: 'inscrit',
      render: (value: string) => value || '-',
    },
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

      <Modal
        title={`Badge RFID — ${badgeEditUser?.nom ?? ''}`}
        open={badgeEditUser !== null}
        onCancel={() => setBadgeEditUser(null)}
        onOk={() => void saveBadge()}
        confirmLoading={savingBadge}
        okText="Enregistrer"
        cancelText="Annuler"
      >
        <Input
          placeholder="Numéro du badge RFID"
          value={badgeValue}
          onChange={(e) => setBadgeValue(e.target.value)}
          prefix={<IdcardOutlined />}
        />
      </Modal>
    </div>
  )
}

export default Utilisateurs
