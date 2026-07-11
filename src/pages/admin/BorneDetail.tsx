import { Link, useParams } from 'react-router-dom'
import { Tabs, Button } from 'antd'
import { ArrowLeftOutlined, EnvironmentOutlined, ToolOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { bornes, sessions } from '../../mock/data'

function BorneDetail() {
  const { id } = useParams()
  const borne = bornes.find((b) => b.id === id)

  if (!borne) {
    return (
      <div className="panel">
        <p>Borne introuvable.</p>
        <Link to="/dashboard/bornes">Retour à la liste</Link>
      </div>
    )
  }

  const history = sessions.filter((s) => s.borne === borne.nom)

  return (
    <div>
      <Link to="/dashboard/bornes" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
        <ArrowLeftOutlined /> Retour aux bornes
      </Link>

      <div className="panel" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, textTransform: 'none' }}>{borne.nom}</h2>
          <p style={{ marginTop: 6, fontSize: 13 }}>
            {borne.reference} · {borne.modele} · {borne.fabricant}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusTag value={borne.etat} />
          <Button icon={<ToolOutlined />}>Créer un ticket</Button>
        </div>
      </div>

      <Tabs
        items={[
          {
            key: 'infos',
            label: 'Informations',
            children: (
              <div className="panel">
                <dl className="detail-grid">
                  <div><dt>Numéro de série</dt><dd>{borne.numeroSerie}</dd></div>
                  <div><dt>Adresse</dt><dd>{borne.adresse}, {borne.ville}</dd></div>
                  <div><dt>Coordonnées GPS</dt><dd><EnvironmentOutlined /> {borne.lat.toFixed(4)}, {borne.lng.toFixed(4)}</dd></div>
                  <div><dt>Version firmware</dt><dd>{borne.firmware}</dd></div>
                  <div><dt>Version OCPP</dt><dd>{borne.ocpp}</dd></div>
                  <div><dt>Puissance</dt><dd>{borne.puissance} kW</dd></div>
                  <div><dt>Dernier heartbeat</dt><dd>{borne.dernierHeartbeat}</dd></div>
                </dl>
              </div>
            ),
          },
          {
            key: 'connecteurs',
            label: `Connecteurs (${borne.connecteurs.length})`,
            children: (
              <div className="connector-grid">
                {borne.connecteurs.map((c) => (
                  <div className="panel connector-card" key={c.id}>
                    <div className="connector-card__head">
                      <span>{c.type}</span>
                      <StatusTag value={c.etat} />
                    </div>
                    <p style={{ fontSize: 13 }}>Puissance : {c.puissance} kW</p>
                    <p style={{ fontSize: 13 }}>{c.disponible ? 'Disponible pour une session' : 'Non disponible'}</p>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'historique',
            label: 'Historique des sessions',
            children: (
              <div className="panel">
                {history.length === 0 ? (
                  <p>Aucune session récente sur cette borne.</p>
                ) : (
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>Connecteur</th>
                        <th>Début</th>
                        <th>Durée</th>
                        <th>Énergie</th>
                        <th>État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((s) => (
                        <tr key={s.id}>
                          <td>{s.utilisateur}</td>
                          <td>{s.connecteur}</td>
                          <td>{s.debut}</td>
                          <td>{s.dureeMin} min</td>
                          <td>{s.energieKwh.toFixed(1)} kWh</td>
                          <td><StatusTag value={s.etat} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

export default BorneDetail
