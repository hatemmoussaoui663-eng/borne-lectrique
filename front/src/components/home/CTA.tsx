import { Link } from 'react-router-dom'
import { ArrowRightOutlined } from '@ant-design/icons'
import './CTA.css'

function CTA() {
  return (
    <section className="cta">
      <div className="container">
        <div className="cta__card">
          <div className="cta__glow" aria-hidden="true" />
          <div className="cta__content">
            <h2 className="cta__title">
              Prêt à digitaliser
              <br />
              votre réseau de recharge&nbsp;?
            </h2>
            <p className="cta__subtitle">
              Centralisez la supervision, la maintenance et la facturation de vos
              bornes sur une seule plateforme, connectée à votre réseau OCPP.
            </p>
          </div>
          <div className="cta__actions">
            <a href="#contact" className="cta__primary">
              Demander une démo <ArrowRightOutlined />
            </a>
            <Link to="/login" className="cta__secondary">
              Accéder au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTA
