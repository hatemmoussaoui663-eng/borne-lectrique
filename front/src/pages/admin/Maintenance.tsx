import { useEffect, useState } from 'react'
import { Button, message, Tag, Modal, Form, Input, Select } from 'antd'
import { PlusOutlined, UserOutlined, ThunderboltOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { getTickets, createTicket, updateTicketStatut, type TicketInput } from '../../api/maintenance'
import { getBorneOptions, type BorneOption } from '../../api/bornes'
import type { TicketMaintenance, TicketPriorite, TicketStatut } from '../../types'
import './Maintenance.css'

const columns: TicketStatut[] = ['Ouvert', 'Planifié', 'En cours', 'Résolu']
const prioriteOptions: TicketPriorite[] = ['Basse', 'Moyenne', 'Haute', 'Critique']

const priorityColor: Record<string, string> = {
  Critique: 'error',
  Haute: 'volcano',
  Moyenne: 'gold',
  Basse: 'default',
}

function Maintenance() {
  const [tickets, setTickets] = useState<TicketMaintenance[]>([])
  const [bornes, setBornes] = useState<BorneOption[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<TicketInput>()

  async function load() {
    try {
      const [t, b] = await Promise.all([getTickets(), getBorneOptions()])
      setTickets(t)
      setBornes(b)
    } catch {
      message.error('Impossible de charger les tickets de maintenance depuis le backend.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    form.resetFields()
    setModalOpen(true)
  }

  async function handleCreate(values: TicketInput) {
    try {
      setSaving(true)
      const created = await createTicket(values)
      setTickets((prev) => [created, ...prev])
      setModalOpen(false)
      message.success('Ticket créé.')
    } catch {
      message.error('Création du ticket impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatutChange(ticket: TicketMaintenance, statut: TicketStatut) {
    try {
      const updated = await updateTicketStatut(ticket.id, statut)
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      message.error('Impossible de changer le statut du ticket.')
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>Ordres de travail et suivi des interventions par borne.</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Créer un ticket
        </Button>
      </div>

      <div className="maintenance-board">
        {columns.map((col) => (
          <div className="maintenance-column" key={col}>
            <div className="maintenance-column__head">
              <span>{col}</span>
              <span className="maintenance-column__count">
                {tickets.filter((t) => t.statut === col).length}
              </span>
            </div>

            {tickets
              .filter((t) => t.statut === col)
              .map((t) => (
                <div className="panel maintenance-card" key={t.id}>
                  <div className="maintenance-card__head">
                    <span className="maintenance-card__borne">
                      <ThunderboltOutlined /> {t.borne}
                    </span>
                    <Tag color={priorityColor[t.priorite]}>{t.priorite}</Tag>
                  </div>
                  <p className="maintenance-card__title">{t.titre}</p>
                  <div className="maintenance-card__foot">
                    <span>
                      <UserOutlined /> {t.technicien || '—'}
                    </span>
                    <span>{t.creeLe}</span>
                  </div>
                  {t.piecesRemplacees.length > 0 && (
                    <div className="maintenance-card__pieces">
                      {t.piecesRemplacees.map((p) => (
                        <Tag key={p}>{p}</Tag>
                      ))}
                    </div>
                  )}
                  <Select
                    size="small"
                    style={{ width: '100%', marginTop: 8 }}
                    value={t.statut}
                    options={columns.map((c) => ({ label: c, value: c }))}
                    onChange={(v) => void handleStatutChange(t, v)}
                  />
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <h3>Historique complet</h3>
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Borne</th>
              <th>Intervention</th>
              <th>Priorité</th>
              <th>Technicien</th>
              <th>Créé le</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.borne}</td>
                <td>{t.titre}</td>
                <td>
                  <Tag color={priorityColor[t.priorite]}>{t.priorite}</Tag>
                </td>
                <td>{t.technicien || '—'}</td>
                <td>{t.creeLe}</td>
                <td>
                  <StatusTag value={t.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        title="Créer un ticket de maintenance"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Créer"
        cancelText="Annuler"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => void handleCreate(v)}>
          <Form.Item label="Borne" name="borneId" rules={[{ required: true, message: 'La borne est requise' }]}>
            <Select
              placeholder="Sélectionner une borne"
              options={bornes.map((b) => ({ label: b.nom, value: b.id }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="Titre" name="titre" rules={[{ required: true, message: 'Le titre est requis' }]}>
            <Input placeholder="Description de l'intervention" />
          </Form.Item>
          <Form.Item label="Priorité" name="priorite" initialValue="Moyenne" rules={[{ required: true }]}>
            <Select options={prioriteOptions.map((p) => ({ label: p, value: p }))} />
          </Form.Item>
          <Form.Item label="Technicien" name="technicien">
            <Input placeholder="Nom du technicien" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Maintenance
