import { useState } from 'react'
import { EnvironmentOutlined, ArrowRightOutlined, ThunderboltFilled } from '@ant-design/icons'
import heroVisual from '../../assets/hero-visual.png'
import './Hero.css'

function Hero() {
  const [query, setQuery] = useState('')

  return (
    <section className="hero" id="home">
      <div className="hero__backdrop" aria-hidden="true">
        <div className="hero__glow hero__glow--a" />
        <div className="hero__glow hero__glow--b" />
        <div className="hero__grid" />
      </div>

      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="eyebrow">
            <ThunderboltFilled /> Plateforme de gestion des bornes de recharge
          </span>
          <h1 className="hero__title">
            Supervisez et pilotez
            <br />
            votre réseau de recharge.
          </h1>
          <p className="hero__subtitle">
            BornElect centralise la supervision temps réel, les sessions, la
            facturation et la maintenance de vos bornes de recharge électrique
            connectées — compatible OCPP 1.6 &amp; 2.0.1.
          </p>

          <form
            className="hero__search"
            onSubmit={(e) => e.preventDefault()}
          >
            <EnvironmentOutlined className="hero__search-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Entrez une ville, un code postal ou une adresse…"
            />
            <button type="submit">
              Rechercher
              <ArrowRightOutlined />
            </button>
          </form>

          <div className="hero__meta">
            <div>
              <strong>1 200+</strong>
              <span>Bornes supervisées</span>
            </div>
            <div>
              <strong>99,9 %</strong>
              <span>Disponibilité réseau</span>
            </div>
            <div>
              <strong>OCPP</strong>
              <span>1.6 &amp; 2.0.1</span>
            </div>
          </div>
        </div>

        <div className="hero__panel" aria-hidden="true">
          <div className="hero__panel-glow" />

          <img src={heroVisual} className="hero__visual" alt="" />

          <div className="hero__card-wrap">
            <div className="hero__card">
              <div className="hero__card-header">
                <span className="hero__pulse" />
                <span>Borne A-12 · Centre-Ville</span>
              </div>

              <div className="hero__card-stats">
                <div>
                  <span className="hero__card-label">Puissance</span>
                  <span className="hero__card-value">150 kW</span>
                </div>
                <div>
                  <span className="hero__card-label">État</span>
                  <span className="hero__card-pill">Disponible</span>
                </div>
              </div>

              <div className="hero__card-chart">
                {[38, 62, 44, 80, 56, 70, 92].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>

              <div className="hero__card-connectors">
                <span>Type 2</span>
                <span>CCS</span>
                <span>CHAdeMO</span>
              </div>
            </div>

            <div className="hero__badge">
              <EnvironmentOutlined />
              <div>
                <strong>24 bornes</strong>
                <span>à proximité</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
