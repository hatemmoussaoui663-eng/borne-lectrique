import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Input, message } from 'antd'
import { MailOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { resetPassword } from '../api/auth'
import './Login.css'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await resetPassword({
        email,
        password,
        password_confirmation: passwordConfirmation,
        token,
      })
      message.success('Mot de passe réinitialisé avec succès.')
      setEmail('')
      setPassword('')
      setPasswordConfirmation('')
    } catch {
      message.error('Impossible de réinitialiser le mot de passe.')
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
            <LockOutlined />
          </span>
          <span className="login__logo-text">BornElect</span>
        </div>

        <h1 className="login__title">Réinitialiser le mot de passe</h1>
        <p className="login__subtitle">
          Entrez votre e-mail et votre nouveau mot de passe.
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

        <label className="login__label" htmlFor="password">
          Nouveau mot de passe
        </label>
        <Input.Password
          id="password"
          size="large"
          prefix={<LockOutlined />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <label className="login__label" htmlFor="passwordConfirmation">
          Confirmer le mot de passe
        </label>
        <Input.Password
          id="passwordConfirmation"
          size="large"
          prefix={<LockOutlined />}
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          placeholder="••••••••"
        />

        <Button
          htmlType="submit"
          type="primary"
          size="large"
          block
          loading={loading}
          className="login__submit"
        >
          Réinitialiser le mot de passe
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

export default ResetPassword
