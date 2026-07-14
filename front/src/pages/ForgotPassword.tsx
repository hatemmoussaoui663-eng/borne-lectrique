import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, message } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { forgotPassword } from '../api/auth'
import './Login.css'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await forgotPassword(email)
      message.success('Un lien de réinitialisation a été envoyé à votre adresse e-mail.')
      setEmail('')
    } catch {
      message.error('Impossible d\'envoyer le lien de réinitialisation.')
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
          Entrez votre adresse e-mail pour recevoir le lien de réinitialisation.
        </p>

        <label className="login__label" htmlFor="email">
          Adresse e-mail
        </label>
        <Input
          id="email"
          size="large"
          prefix={<MailOutlined />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button
          htmlType="submit"
          type="primary"
          size="large"
          block
          loading={loading}
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
