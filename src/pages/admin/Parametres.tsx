import { Form, Input, Select, Switch, Button, message } from 'antd'

function Parametres() {
  const [form] = Form.useForm()

  return (
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
  )
}

export default Parametres
