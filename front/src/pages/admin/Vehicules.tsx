import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, IdcardOutlined } from '@ant-design/icons'
import { getVehicules, createVehicule, updateVehicule, deleteVehicule, type VehiculeInput } from '../../api/vehicules'
import { getUsers } from '../../api/users'
import { useAuth } from '../../context/AuthContext'
import type { AppUser, ConnecteurType, Vehicule } from '../../types'

const connecteurOptions: ConnecteurType[] = ['CCS', 'Type2', 'CHAdeMO', 'AC', 'DC']

function Vehicules() {
  const { can, user } = useAuth()
  // Vehicle management is an Exploitant task — Admin's usual "full access
  // everywhere" is deliberately not extended here: read-only (see
  // VehiculeController::ensureNotSuperAdmin on the backend).
  const canWrite = can('vehicules', 'full') && user?.role_slug !== 'super_admin'
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Vehicule | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<VehiculeInput>()

  async function load() {
    try {
      setLoading(true)
      const [v, u] = await Promise.all([getVehicules(), getUsers()])
      setVehicules(v)
      setUsers(u)
    } catch {
      message.error('Impossible de charger les véhicules depuis le backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(v: Vehicule) {
    setEditing(v)
    const owner = users.find((u) => u.nom === v.proprietaire)
    form.setFieldsValue({
      userId: owner?.id,
      marque: v.marque,
      modele: v.modele,
      immatriculation: v.immatriculation,
      connecteur: v.connecteur,
      capaciteKwh: v.capaciteKwh,
    })
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    try {
      await deleteVehicule(id)
      setVehicules((prev) => prev.filter((v) => v.id !== id))
      message.success('Véhicule supprimé.')
    } catch {
      message.error('Suppression impossible.')
    }
  }

  async function handleSave(values: VehiculeInput) {
    try {
      setSaving(true)
      const saved = editing ? await updateVehicule(editing.id, values) : await createVehicule(values)
      setVehicules((prev) =>
        editing ? prev.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...prev]
      )
      setModalOpen(false)
      message.success(editing ? 'Véhicule mis à jour.' : 'Véhicule ajouté.')
    } catch {
      message.error('Enregistrement impossible (immatriculation déjà utilisée ?).')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: 'Propriétaire', dataIndex: 'proprietaire', render: (v: string) => v || '—' },
    {
      title: 'Badge RFID',
      dataIndex: 'badge',
      render: (v: string | null) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: v ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <IdcardOutlined /> {v || '—'}
        </span>
      ),
    },
    {
      title: 'Véhicule',
      dataIndex: 'marque',
      render: (_: string, r: Vehicule) => `${r.marque} ${r.modele}`,
    },
    { title: 'Immatriculation', dataIndex: 'immatriculation' },
    { title: 'Connecteur', dataIndex: 'connecteur', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Capacité batterie', dataIndex: 'capaciteKwh', render: (v: number) => `${v} kWh` },
    ...(canWrite
      ? [
          {
            title: '',
            dataIndex: 'action',
            render: (_: unknown, r: Vehicule) => (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                  Modifier
                </Button>
                <Popconfirm title="Supprimer ce véhicule ?" onConfirm={() => void handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Supprimer
                  </Button>
                </Popconfirm>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>Véhicules électriques associés aux utilisateurs.</p>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Ajouter un véhicule
          </Button>
        )}
      </div>

      <div className="panel">
        <Table rowKey="id" columns={columns} dataSource={vehicules} loading={loading} pagination={{ pageSize: 8 }} />
      </div>

      <Modal
        title={editing ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)}>
          <Form.Item label="Propriétaire" name="userId">
            <Select
              allowClear
              placeholder="Aucun (non assigné)"
              options={users.map((u) => ({ label: u.nom, value: u.id }))}
            />
          </Form.Item>
          <Form.Item label="Marque" name="marque" rules={[{ required: true, message: 'La marque est requise' }]}>
            <Input placeholder="Renault, Tesla…" />
          </Form.Item>
          <Form.Item label="Modèle" name="modele" rules={[{ required: true, message: 'Le modèle est requis' }]}>
            <Input placeholder="Zoe, Model 3…" />
          </Form.Item>
          <Form.Item
            label="Immatriculation"
            name="immatriculation"
            rules={[{ required: true, message: "L'immatriculation est requise" }]}
          >
            <Input placeholder="123TU4567" />
          </Form.Item>
          <Form.Item label="Type de connecteur" name="connecteur" rules={[{ required: true }]}>
            <Select options={connecteurOptions.map((c) => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item
            label="Capacité batterie (kWh)"
            name="capaciteKwh"
            rules={[{ required: true, message: 'La capacité est requise' }]}
          >
            <InputNumber min={1} max={500} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Vehicules
