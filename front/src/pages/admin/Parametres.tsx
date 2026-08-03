import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, Switch, Button, message, Spin } from 'antd'
import { getTarif, updateTarif } from '../../api/tarifs'

function TarifSettings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getTarif()
      .then((tarif) => form.setFieldsValue({ prixKwh: tarif.prixKwh }))
      .finally(() => setLoading(false))
  }, [form])

  async function handleSave(values: { prixKwh: number }) {
    try {
      setSaving(true)
      await updateTarif(values.prixKwh)
      message.success('Tarif mis à jour — appliqué aux prochaines sessions terminées.')
    } catch {
      message.error('Impossible d’enregistrer le tarif.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 640, marginBottom: 24 }}>
      <div className="panel__head">
        <h3>Tarification</h3>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)}>
          <Form.Item
            label="Prix par kWh (DT)"
            name="prixKwh"
            rules={[{ required: true, message: 'Le prix est requis' }]}
          >
            <InputNumber min={0} step={0.01} precision={3} style={{ width: 200 }} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            Enregistrer le tarif
          </Button>
        </Form>
      )}
    </div>
  )
}

function Parametres() {
  const [form] = Form.useForm()

  return (
    <div>
      <TarifSettings />

      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel__head">
          <h3>Paramètres système</h3>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            nom: 'BornElect',
            fuseau: 'Africa/Tunis',
            langue: 'fr',
            email: true,
            sms: false,
            push: true,
          }}
          onFinish={() => message.success('Paramètres enregistrés (démo locale).')}
        >
          <Form.Item label="Nom de la plateforme" name="nom">
            <Input />
          </Form.Item>

          <Form.Item label="Fuseau horaire" name="fuseau">
            <Select
              options={[
                { value: 'Africa/Tunis', label: 'Africa/Tunis (GMT+1)' },
                { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
                { value: 'UTC', label: 'UTC' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Langue par défaut" name="langue">
            <Select
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'العربية' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Notifications par e-mail" name="email" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Notifications par SMS" name="sms" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Notifications push" name="push" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Button type="primary" htmlType="submit">
            Enregistrer
          </Button>
        </Form>
      </div>
    </div>
  )
}

export default Parametres
