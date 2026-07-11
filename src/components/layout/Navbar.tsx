import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MenuOutlined, CloseOutlined, ThunderboltFilled } from '@ant-design/icons'
import './Navbar.css'

const links = [
  { label: 'Accueil', href: '#home' },
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Supervision', href: '#supervision' },
  { label: 'Tarification', href: '#tarification' },
  { label: 'Contact', href: '#contact' },
]

function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-badge">
            <ThunderboltFilled />
          </span>
          <span className="navbar__logo-text">BornElect</span>
        </Link>

        <nav className={`navbar__links ${open ? 'navbar__links--open' : ''}`}>
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link to="/login" className="navbar__links-cta-mobile">
            Connexion
          </Link>
        </nav>

        <div className="navbar__actions">
          <Link to="/login" className="navbar__login">
            Connexion
          </Link>
          <Link to="/login" className="navbar__cta">
            <span>Accéder au tableau de bord</span>
            <span className="navbar__cta-arrow">→</span>
          </Link>
        </div>

        <button
          type="button"
          className="navbar__burger"
          aria-label="Ouvrir le menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </div>
    </header>
  )
}

export default Navbar
