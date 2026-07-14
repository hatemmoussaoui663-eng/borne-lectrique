import { Button, message, Tag } from 'antd'
import { PlusOutlined, UserOutlined, ThunderboltOutlined } from '@ant-design/icons'
import StatusTag from '../../components/admin/StatusTag'
import { tickets } from '../../mock/data'
import type { TicketStatut } from '../../types'
import './Maintenance.css'

const columns: TicketStatut[] = ['Ouvert', 'Planifié', 'En cours', 'Résolu']

const priorityColor: Record<string, string> = {
  Critique: 'error',
  Haute: 'volcano',
  Moyenne: 'gold',
  Basse: 'default',
}

function Maintenance() {
  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>Ordres de travail et suivi des interventions par borne.</p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info('Formulaire à connecter à l’API Laravel (POST /maintenance).')}
        >
          Créer un ticket
        </Button>
      </div>

      <div className="maintenance-board">
        {columns.map((col) => (
          <div className="maintenance-column" key={col}>
            <div className="maintenance-column__head">
              <span>{col}</span>
              <span className="maintenance-column__count">
                {tickets.filter((t) => t.statut === col).length}
              </span>
            </div>

            {tickets
              .filter((t) => t.statut === col)
              .map((t) => (
                <div className="panel maintenance-card" key={t.id}>
                  <div className="maintenance-card__head">
                    <span className="maintenance-card__borne">
                      <ThunderboltOutlined /> {t.borne}
                    </span>
                    <Tag color={priorityColor[t.priorite]}>{t.priorite}</Tag>
                  </div>
                  <p className="maintenance-card__title">{t.titre}</p>
                  <div className="maintenance-card__foot">
                    <span>
                      <UserOutlined /> {t.technicien}
                    </span>
                    <span>{t.creeLe}</span>
                  </div>
                  {t.piecesRemplacees.length > 0 && (
                    <div className="maintenance-card__pieces">
                      {t.piecesRemplacees.map((p) => (
                        <Tag key={p}>{p}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <h3>Historique complet</h3>
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Borne</th>
              <th>Intervention</th>
              <th>Priorité</th>
              <th>Technicien</th>
              <th>Créé le</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.borne}</td>
                <td>{t.titre}</td>
                <td>
                  <Tag color={priorityColor[t.priorite]}>{t.priorite}</Tag>
                </td>
                <td>{t.technicien}</td>
                <td>{t.creeLe}</td>
                <td>
                  <StatusTag value={t.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Maintenance
