import { ThunderboltFilled } from '@ant-design/icons'
import './Footer.css'

const columns = [
  {
    title: 'Plateforme',
    links: ['Supervision temps réel', 'Sessions de recharge', 'Paiement & facturation', 'Maintenance'],
  },
  {
    title: 'Ressources',
    links: ['Documentation API', 'Compatibilité OCPP', 'Statut du réseau', 'Blog'],
  },
  {
    title: 'Entreprise',
    links: ['À propos', 'Carrières', 'Contact', 'Mentions légales'],
  },
]

function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <div className="navbar__logo">
            <span className="navbar__logo-badge">
              <ThunderboltFilled />
            </span>
            <span className="navbar__logo-text">BornElect</span>
          </div>
          <p className="site-footer__tagline">
            Plateforme de supervision et de gestion de réseaux de bornes de recharge
            électrique connectées, compatible OCPP 1.6 / 2.0.1.
          </p>
        </div>

        {columns.map((col) => (
          <div className="site-footer__col" key={col.title}>
            <h4>{col.title}</h4>
            <ul>
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#">{link}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} BornElect. Tous droits réservés.</span>
        <span>Fait pour la mobilité électrique.</span>
      </div>
    </footer>
  )
}

export default Footer
