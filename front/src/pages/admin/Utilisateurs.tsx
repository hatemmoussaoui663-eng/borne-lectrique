import { useEffect, useMemo, useState } from 'react'
import { Table, Input, Select, Button, message, Tag, Modal, DatePicker, Form, Switch, Popconfirm } from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  CreditCardOutlined,
  IdcardOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import StatusTag from '../../components/admin/StatusTag'
import {
  getUsers,
  updateUserBadge,
  createUser,
  updateUser,
  deleteUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '../../api/users'
import { getRoles, type Role } from '../../api/roles'
import { useAuth } from '../../context/AuthContext'
import type { AppUser, BadgeStatut, UserRole } from '../../types'

const roleOptions: UserRole[] = [
  'Super Administrateur',
  'Exploitant',
  'Opérateur',
  'Technicien',
  'Service Client',
  'Client',
]

const badgeStatutOptions: BadgeStatut[] = ['Actif', 'Bloqué', 'Expiré']

interface BadgeFormValues {
  code: string
  status: BadgeStatut
  expiresAt: Dayjs | null
}

interface CreateFormValues {
  name: string
  email: string
  phone?: string
  roleId: number
  isActive: boolean
  password: string
}

interface EditFormValues {
  name: string
  email: string
  phone?: string
  roleId: number
  isActive: boolean
  password?: string
}

function Utilisateurs() {
  const { can, user } = useAuth()
  const canWrite = can('utilisateurs', 'full')
  // Account CRUD (create/edit/delete) is reserved to the Super Administrateur
  // even though Exploitant/Service Client have full read access to /users
  // and can still manage RFID badges (a separate, more operational task).
  const canManageAccounts = user?.role_slug === 'super_admin'
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>()
  const [badgeEditUser, setBadgeEditUser] = useState<AppUser | null>(null)
  const [savingBadge, setSavingBadge] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form] = Form.useForm<BadgeFormValues>()
  const [createForm] = Form.useForm<CreateFormValues>()
  const [editForm] = Form.useForm<EditFormValues>()

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

    // Needed for both the create and edit forms' role picker — both are Admin-only.
    if (canManageAccounts) {
      void getRoles()
        .then(setRoles)
        .catch(() => message.error('Impossible de charger la liste des rôles.'))
    }
  }, [canManageAccounts])

  function openCreateModal() {
    createForm.resetFields()
    createForm.setFieldsValue({ isActive: true })
    setCreateModalOpen(true)
  }

  async function handleCreateUser(values: CreateFormValues) {
    try {
      setSavingUser(true)
      const input: CreateUserInput = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        roleId: values.roleId,
        isActive: values.isActive,
        password: values.password,
      }
      const created = await createUser(input)
      setUsers((prev) => [...prev, created])
      setCreateModalOpen(false)
      message.success('Utilisateur créé.')
    } catch {
      message.error('Création impossible (email déjà utilisé ?).')
    } finally {
      setSavingUser(false)
    }
  }

  function openEditModal(target: AppUser) {
    setEditUser(target)
    editForm.resetFields()
    editForm.setFieldsValue({
      name: target.nom,
      email: target.email,
      phone: target.phone ?? undefined,
      roleId: roles.find((r) => r.displayName === target.role)?.id,
      isActive: target.statut === 'Actif',
    })
  }

  async function handleEditUser(values: EditFormValues) {
    if (!editUser) return
    try {
      setSavingEdit(true)
      const input: UpdateUserInput = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        roleId: values.roleId,
        isActive: values.isActive,
        password: values.password,
      }
      const updated = await updateUser(editUser.id, input)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      setEditUser(null)
      message.success('Utilisateur mis à jour.')
    } catch {
      message.error('Mise à jour impossible (email déjà utilisé ?).')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteUser(target: AppUser) {
    try {
      setDeletingId(target.id)
      await deleteUser(target.id)
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      message.success('Utilisateur supprimé.')
    } catch {
      message.error('Suppression impossible.')
    } finally {
      setDeletingId(null)
    }
  }

  function openBadgeEditor(user: AppUser) {
    setBadgeEditUser(user)
    form.setFieldsValue({
      code: user.badge?.code ?? '',
      status: user.badge?.status ?? 'Actif',
      expiresAt: user.badge?.expiresAt ? dayjs(user.badge.expiresAt) : null,
    })
  }

  async function saveBadge(values: BadgeFormValues) {
    if (!badgeEditUser) return
    try {
      setSavingBadge(true)
      const updated = await updateUserBadge(badgeEditUser.id, {
        code: values.code.trim(),
        status: values.status,
        expiresAt: values.expiresAt ? values.expiresAt.format('YYYY-MM-DD') : null,
      })
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

  const badgeStatutColor: Record<BadgeStatut, string> = {
    Actif: 'success',
    Bloqué: 'error',
    Expiré: 'default',
  }

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
      dataIndex: 'badge',
      render: (_: AppUser['badge'], r: AppUser) =>
        canWrite ? (
          <Button
            size="small"
            type="text"
            icon={<IdcardOutlined />}
            onClick={() => openBadgeEditor(r)}
            style={{ color: r.badge ? 'var(--text-primary)' : 'var(--text-muted)' }}
          >
            {r.badge ? r.badge.code : 'Associer un badge'}
          </Button>
        ) : (
          <span style={{ color: r.badge ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <IdcardOutlined /> {r.badge ? r.badge.code : 'Aucun badge'}
          </span>
        ),
    },
    {
      title: 'Statut badge',
      dataIndex: 'badge',
      render: (_: AppUser['badge'], r: AppUser) =>
        r.badge ? <Tag color={badgeStatutColor[r.badge.status]}>{r.badge.status}</Tag> : <span>-</span>,
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
    ...(canManageAccounts
      ? [
          {
            title: 'Actions',
            dataIndex: 'actions',
            render: (_: unknown, r: AppUser) => {
              const isSelf = r.id === user?.id
              return (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(r)}
                    aria-label="Modifier"
                  />
                  <Popconfirm
                    title="Supprimer cet utilisateur ?"
                    description={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte.' : undefined}
                    onConfirm={() => void handleDeleteUser(r)}
                    okText="Supprimer"
                    cancelText="Annuler"
                    okButtonProps={{ danger: true }}
                    disabled={isSelf}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deletingId === r.id}
                      disabled={isSelf}
                      aria-label="Supprimer"
                    />
                  </Popconfirm>
                </div>
              )
            },
          },
        ]
      : []),
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
        {canManageAccounts && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Ajouter un utilisateur
          </Button>
        )}
      </div>

      <div className="panel">
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} />
      </div>

      <Modal
        title={`Badge RFID — ${badgeEditUser?.nom ?? ''}`}
        open={badgeEditUser !== null}
        onCancel={() => setBadgeEditUser(null)}
        onOk={() => form.submit()}
        confirmLoading={savingBadge}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => void saveBadge(v)}>
          <Form.Item
            label={
              badgeEditUser?.badge?.used
                ? 'Numéro du badge (verrouillé — déjà utilisé pour une recharge)'
                : badgeEditUser?.badge
                  ? 'Numéro du badge (laisser vide pour détacher)'
                  : 'Numéro du badge (laisser vide pour générer automatiquement)'
            }
            name="code"
          >
            <Input
              placeholder={badgeEditUser?.badge ? 'Numéro du badge RFID' : 'Auto (RFID-XXXX)'}
              prefix={<IdcardOutlined />}
              disabled={badgeEditUser?.badge?.used}
            />
          </Form.Item>
          <Form.Item label="Statut" name="status">
            <Select options={badgeStatutOptions.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item label="Date d'expiration (optionnelle)" name="expiresAt">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Ajouter un utilisateur"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={savingUser}
        okText="Créer"
        cancelText="Annuler"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => void handleCreateUser(v)}>
          <Form.Item label="Nom complet" name="name" rules={[{ required: true, message: 'Le nom est requis' }]}>
            <Input placeholder="Nom et prénom" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "L'email est requis" },
              { type: 'email', message: 'Email invalide' },
            ]}
          >
            <Input placeholder="utilisateur@borne-electrique.com" />
          </Form.Item>
          <Form.Item label="Téléphone" name="phone">
            <Input placeholder="+216 00 000 000" />
          </Form.Item>
          <Form.Item label="Rôle" name="roleId" rules={[{ required: true, message: 'Le rôle est requis' }]}>
            <Select
              placeholder="Sélectionner un rôle"
              options={roles.map((r) => ({ label: r.displayName, value: r.id }))}
            />
          </Form.Item>
          <Form.Item
            label="Mot de passe"
            name="password"
            rules={[
              { required: true, message: 'Le mot de passe est requis' },
              { min: 8, message: 'Au moins 8 caractères' },
            ]}
          >
            <Input.Password placeholder="Mot de passe initial" />
          </Form.Item>
          <Form.Item label="Compte actif" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Modifier — ${editUser?.nom ?? ''}`}
        open={editUser !== null}
        onCancel={() => setEditUser(null)}
        onOk={() => editForm.submit()}
        confirmLoading={savingEdit}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={(v) => void handleEditUser(v)}>
          <Form.Item label="Nom complet" name="name" rules={[{ required: true, message: 'Le nom est requis' }]}>
            <Input placeholder="Nom et prénom" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "L'email est requis" },
              { type: 'email', message: 'Email invalide' },
            ]}
          >
            <Input placeholder="utilisateur@borne-electrique.com" />
          </Form.Item>
          <Form.Item label="Téléphone" name="phone">
            <Input placeholder="+216 00 000 000" />
          </Form.Item>
          <Form.Item label="Rôle" name="roleId" rules={[{ required: true, message: 'Le rôle est requis' }]}>
            <Select
              placeholder="Sélectionner un rôle"
              options={roles.map((r) => ({ label: r.displayName, value: r.id }))}
            />
          </Form.Item>
          <Form.Item
            label="Nouveau mot de passe (laisser vide pour ne pas changer)"
            name="password"
            rules={[{ min: 8, message: 'Au moins 8 caractères' }]}
          >
            <Input.Password placeholder="Mot de passe" />
          </Form.Item>
          <Form.Item label="Compte actif" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Utilisateurs
