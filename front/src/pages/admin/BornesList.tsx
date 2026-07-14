import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Table, Input, Select, Button, message, Modal, Form, AutoComplete } from 'antd'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { SearchOutlined, PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import BornesMap from '../../components/admin/BornesMap'
import { apiClient } from '../../api/client'
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
  const [bornes, setBornes] = useState<Borne[]>([])
  const [search, setSearch] = useState('')
  const [etatFilter, setEtatFilter] = useState<BorneEtat | undefined>()
  const [loading, setLoading] = useState(true)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [isMapModalVisible, setIsMapModalVisible] = useState(false)
  const [mapPos, setMapPos] = useState<[number, number] | null>(null)

  function MapClickMarker({ setPosition }: { setPosition: (p: [number, number]) => void }) {
    useMapEvents({
      click(e) {
        setPosition([e.latlng.lat, e.latlng.lng])
      },
    })
    return null
  }

  const loadBornes = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get('/bornes')

      // Normalize API response to frontend `Borne` shape
      const normalized: Borne[] = (data || []).map((item: any) => ({
        id: String(item.id ?? item.ID ?? item._id ?? ''),
        nom: item.nom ?? item.name ?? '',
        reference: item.reference ?? '',
        numeroSerie: item.numeroSerie ?? item.numero_serie ?? '',
        modele: item.modele ?? '',
        fabricant: item.fabricant ?? '',
        adresse: item.adresse ?? '',
        ville: item.ville ?? item.city ?? '',
        lat: Number(item.lat ?? item.latitude ?? item.latitude ?? 0) || 0,
        lng: Number(item.lng ?? item.longitude ?? item.longitude ?? 0) || 0,
        firmware: item.firmware ?? '',
        ocpp: item.ocpp ?? '1.6',
        puissance: Number(item.puissance ?? item.power ?? 22) || 22,
        etat: (item.etat ?? item.status ?? 'Déconnectée') as BorneEtat,
        dernierHeartbeat: item.dernierHeartbeat ?? item.last_heartbeat ?? item.updated_at ?? '',
        connecteurs: item.connecteurs ?? [],
      }))

      console.debug('Loaded bornes:', normalized)
      setBornes(normalized)
    } catch {
      message.error('Impossible de charger les bornes depuis l’API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBornes()
  }, [])

  const filtered = useMemo(() => {
    return bornes.filter((b) => {
      const matchesSearch =
        !search ||
        b.nom.toLowerCase().includes(search.toLowerCase()) ||
        b.ville.toLowerCase().includes(search.toLowerCase())
      const matchesEtat = !etatFilter || b.etat === etatFilter
      return matchesSearch && matchesEtat
    })
  }, [bornes, search, etatFilter])

  const handleCreate = () => {
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      // send minimal payload to backend; controller will persist allowed fields
      const payload = {
        name: values.nom,
        reference: values.reference,
        numero_serie: values.numeroSerie,
        modele: values.modele,
        fabricant: values.fabricant,
        adresse: values.adresse,
        ville: values.ville,
        status: values.etat,
        latitude: values.lat || null,
        longitude: values.lng || null,
        puissance: values.puissance ?? 22,
        ocpp: values.ocpp ?? '1.6',
        firmware: values.firmware ?? '',
        connecteurs: values.connecteurs ?? undefined,
      }

      const { data } = await apiClient.post('/bornes', payload)

      // map backend response to frontend Borne shape
      const newBorne: Borne = {
        id: String(data.id),
        nom: data.name ?? values.nom,
        reference: values.reference ?? `REF-${Date.now()}`,
        numeroSerie: values.numeroSerie ?? '',
        modele: values.modele ?? '',
        fabricant: values.fabricant ?? '',
        adresse: values.adresse ?? '',
        ville: values.ville ?? '',
        lat: data.latitude ?? values.lat ?? 0,
        lng: data.longitude ?? values.lng ?? 0,
        firmware: '',
        ocpp: '1.6',
        puissance: values.puissance ?? 22,
        etat: (data.status ?? values.etat) as BorneEtat,
        dernierHeartbeat: new Date().toISOString(),
        connecteurs: values.connecteurs ?? [
          { id: `c-${Date.now()}`, type: 'Type2', puissance: values.puissance ?? 22, etat: values.etat ?? 'Disponible', disponible: true },
        ],
      }

      setBornes((current) => [newBorne, ...current])
      setIsModalVisible(false)
      message.success('Borne créée avec succès')
    } catch (err) {
      // validation or request error
      if (err && typeof err === 'object' && 'response' in err) {
        message.error('La création de la borne a échoué')
      }
    }
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/bornes/${id}`)
      setBornes((current) => current.filter((item) => item.id !== id))
      message.success('Borne supprimée')
    } catch {
      message.error('La suppression a échoué')
    }
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/dashboard/bornes/${record.id}`}>
            <Button size="small" icon={<EyeOutlined />}>
              Détail
            </Button>
          </Link>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => void handleDelete(record.id)}>
            Supprimer
          </Button>
        </div>
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
          onClick={() => void handleCreate()}
        >
          Ajouter une borne
        </Button>
      </div>

      <Modal
        title="Créer une nouvelle borne"
        open={isModalVisible}
        onOk={() => void handleModalOk()}
        onCancel={handleModalCancel}
        okText="Créer"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Veuillez renseigner le nom' }]}>
            <Input placeholder="Nom de la borne" />
          </Form.Item>

          <Form.Item name="reference" label="Référence">
            <Input placeholder="REF-..." />
          </Form.Item>

          <Form.Item name="ville" label="Ville" rules={[{ required: true, message: 'Veuillez renseigner la ville' }]}>
            <AutoComplete
              options={
                [...new Set(bornes.map((b) => b.ville).filter(Boolean))].map((v) => ({ value: String(v) }))
              }
              placeholder="Ville"
              filterOption={(inputValue, option) =>
                typeof option?.value === 'string' && option.value.toLowerCase().includes(inputValue.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name="modele" label="Modèle">
            <Input placeholder="Modèle" />
          </Form.Item>

          <Form.Item name="fabricant" label="Fabricant">
            <Input placeholder="Fabricant" />
          </Form.Item>

          <Form.Item name="adresse" label="Adresse">
            <Input placeholder="Adresse" />
          </Form.Item>

          <Form.Item name="puissance" label="Puissance (kW)">
            <Input type="number" placeholder="22" />
          </Form.Item>

          <Form.Item name="etat" label="État" initialValue={"Disponible"}>
            <Select options={etatOptions.map((e) => ({ label: e, value: e }))} />
          </Form.Item>

          <Form.Item label="Localisation">
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="lat" noStyle>
                <Input placeholder="36.8" style={{ width: 140 }} />
              </Form.Item>
              <Form.Item name="lng" noStyle>
                <Input placeholder="10.1" style={{ width: 140 }} />
              </Form.Item>
              <Button type="default" onClick={() => setIsMapModalVisible(true)}>
                Choisir sur la carte
              </Button>
            </div>
          </Form.Item>

          <Modal
            title="Sélectionner l'emplacement"
            open={isMapModalVisible}
            onOk={() => {
              if (mapPos) {
                form.setFieldsValue({ lat: mapPos[0], lng: mapPos[1] })
              }
              setIsMapModalVisible(false)
            }}
            onCancel={() => setIsMapModalVisible(false)}
            width={700}
            okText="Valider"
          >
            <div style={{ height: 400 }}>
              <MapContainer center={[36.8, 10.18]} zoom={10} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <MapClickMarker setPosition={setMapPos} />
                {mapPos && <Marker position={mapPos} />}
              </MapContainer>
            </div>
            <div style={{ marginTop: 8 }}>
              <small>Cliquez sur la carte pour positionner la borne.</small>
            </div>
          </Modal>
        </Form>
      </Modal>

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
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </div>
    </div>
  )
}

export default BornesList
