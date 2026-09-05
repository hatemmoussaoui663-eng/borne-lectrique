import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Segmented, message } from 'antd'
import { MailOutlined, PhoneOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { forgotPassword } from '../api/auth'
import { messageErreurApi } from '../api/erreurs'
import './Login.css'

type Canal = 'email' | 'phone'

function ForgotPassword() {
  const [canal, setCanal] = useState<Canal>('email')
  const [valeur, setValeur] = useState('')
  const [loading, setLoading] = useState(false)

  const parEmail = canal === 'email'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await forgotPassword(parEmail ? { email: valeur } : { phone: valeur })
      message.success(
        parEmail
          ? 'Un lien de réinitialisation a été envoyé à votre adresse e-mail.'
          : 'Un lien de réinitialisation a été envoyé par SMS.',
      )
      setValeur('')
    } catch (error: unknown) {
      message.error(messageErreurApi(error, "Impossible d'envoyer le lien de réinitialisation."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login__glow" aria-hidden="true" />
      <form className="login__card" onSubmit={handleSubmit}>
        <div className="login__logo">
          <span className="login__logo-badge">
            <MailOutlined />
          </span>
          <span className="login__logo-text">BornElect</span>
        </div>

        <h1 className="login__title">Mot de passe oublié</h1>
        <p className="login__subtitle">
          Recevez le lien de réinitialisation par e-mail ou par SMS.
        </p>

        <Segmented<Canal>
          block
          value={canal}
          onChange={(v) => {
            setCanal(v)
            setValeur('')
          }}
          options={[
            { label: 'E-mail', value: 'email', icon: <MailOutlined /> },
            { label: 'Téléphone', value: 'phone', icon: <PhoneOutlined /> },
          ]}
          className="login__canaux"
        />

        <label className="login__label" htmlFor="identifiant">
          {parEmail ? 'Adresse e-mail' : 'Numéro de téléphone'}
        </label>
        <Input
          id="identifiant"
          size="large"
          type={parEmail ? 'email' : 'tel'}
          inputMode={parEmail ? 'email' : 'tel'}
          autoComplete={parEmail ? 'email' : 'tel'}
          placeholder={parEmail ? 'vous@exemple.com' : '+216 22 410 552'}
          prefix={parEmail ? <MailOutlined /> : <PhoneOutlined />}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
        />

        <Button
          htmlType="submit"
          type="primary"
          size="large"
          block
          loading={loading}
          disabled={valeur.trim() === ''}
          className="login__submit"
        >
          Envoyer le lien
        </Button>

        <p className="login__hint">
          <Link to="/login">
            <ArrowLeftOutlined /> Retour à la connexion
          </Link>
        </p>
      </form>
    </div>
  )
}

export default ForgotPassword
