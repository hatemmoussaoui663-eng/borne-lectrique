import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import {
  getMyVehicules,
  createMyVehicule,
  updateMyVehicule,
  deleteMyVehicule,
  type MyVehiculeInput,
} from '../../api/me'
import type { ConnecteurType, Vehicule } from '../../types'

const connecteurOptions: ConnecteurType[] = ['CCS', 'Type2', 'CHAdeMO', 'AC', 'DC']

function ClientVehicules() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Vehicule | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<MyVehiculeInput>()

  async function load() {
    try {
      setLoading(true)
      setVehicules(await getMyVehicules())
    } catch {
      message.error('Impossible de charger vos véhicules.')
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
    form.setFieldsValue({
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
      await deleteMyVehicule(id)
      setVehicules((prev) => prev.filter((v) => v.id !== id))
      message.success('Véhicule supprimé.')
    } catch {
      message.error('Suppression impossible.')
    }
  }

  async function handleSave(values: MyVehiculeInput) {
    try {
      setSaving(true)
      const saved = editing ? await updateMyVehicule(editing.id, values) : await createMyVehicule(values)
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
    {
      title: 'Véhicule',
      dataIndex: 'marque',
      render: (_: string, r: Vehicule) => `${r.marque} ${r.modele}`,
    },
    { title: 'Immatriculation', dataIndex: 'immatriculation' },
    { title: 'Connecteur', dataIndex: 'connecteur', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Capacité batterie', dataIndex: 'capaciteKwh', render: (v: number) => `${v} kWh` },
    {
      // §8 « Historique recharges » : cumuls calculés côté serveur à partir des
      // sessions rattachées à ce véhicule.
      title: 'Recharges',
      dataIndex: 'recharges',
      render: (_: unknown, r: Vehicule) => {
        const stats = r.recharges
        if (!stats || stats.nombre === 0) {
          return <span style={{ color: 'var(--text-muted)' }}>Aucune</span>
        }
        return (
          <div>
            <strong>{stats.nombre}</strong> recharge{stats.nombre > 1 ? 's' : ''}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {stats.energieKwh.toFixed(1)} kWh · {stats.coutDt.toFixed(3)} DT
            </div>
          </div>
        )
      },
    },
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

  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>Véhicules électriques associés à votre compte.</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Ajouter un véhicule
        </Button>
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

export default ClientVehicules
