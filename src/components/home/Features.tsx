import {
  DashboardOutlined,
  ThunderboltOutlined,
  CreditCardOutlined,
  ToolOutlined,
  BarChartOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import './Features.css'

const features = [
  {
    icon: <DashboardOutlined />,
    title: 'Supervision temps réel',
    description:
      "Carte interactive, état des bornes, occupation, température et dernier heartbeat en un coup d'œil.",
  },
  {
    icon: <ThunderboltOutlined />,
    title: 'Sessions de recharge',
    description:
      'Création, démarrage, pause et clôture des sessions avec suivi énergie consommée et durée.',
  },
  {
    icon: <CreditCardOutlined />,
    title: 'Paiement & facturation',
    description:
      'Carte bancaire, wallet, abonnements et factures PDF générées automatiquement.',
  },
  {
    icon: <ToolOutlined />,
    title: 'Maintenance & alertes',
    description:
      "Ordres de travail, historique des pannes et alertes automatiques en cas de défaut.",
  },
  {
    icon: <BarChartOutlined />,
    title: 'Rapports décisionnels',
    description:
      'Tableaux de bord CA, consommation, disponibilité, top bornes et top clients, exportables.',
  },
  {
    icon: <ApiOutlined />,
    title: 'Compatible OCPP',
    description:
      'Communication bidirectionnelle avec les bornes via OCPP 1.6 et 2.0.1, prêt pour le multi-fabricant.',
  },
]

function Features() {
  return (
    <section className="features" id="fonctionnalites">
      <div className="container">
        <div className="features__head">
          <span className="eyebrow">
            <ThunderboltOutlined /> Pourquoi nous choisir
          </span>
          <h2 className="features__title">
            Une gestion intelligente
            <br />
            pour un réseau plus fiable.
          </h2>
          <p className="features__subtitle">
            BornElect centralise la supervision, réduit les temps d'intervention et
            améliore la disponibilité de votre réseau — avec des tableaux de bord
            décisionnels en temps réel.
          </p>
        </div>

        <div className="features__grid">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-card__icon">{f.icon}</div>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__desc">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
