import ReactECharts from 'echarts-for-react'
import { Link } from 'react-router-dom'
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  HistoryOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import StatCard from '../../components/admin/StatCard'
import StatusTag from '../../components/admin/StatusTag'
import BornesMap from '../../components/admin/BornesMap'
import { alertes, bornes, consumptionSeries, kpis, sessions } from '../../mock/data'
import './Dashboard.css'

function Dashboard() {
  const chartOption = {
    grid: { left: 40, right: 16, top: 20, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: consumptionSeries.days,
      axisLine: { lineStyle: { color: 'rgba(169,188,172,0.3)' } },
      axisLabel: { color: '#a9bcac' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(140,200,150,0.1)' } },
      axisLabel: { color: '#a9bcac' },
    },
    series: [
      {
        data: consumptionSeries.kwh,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#6fe45c', width: 3 },
        itemStyle: { color: '#6fe45c' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(111,228,92,0.35)' },
              { offset: 1, color: 'rgba(111,228,92,0)' },
            ],
          },
        },
      },
    ],
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__stats">
        <StatCard icon={<ThunderboltOutlined />} label="Bornes gérées" value={String(kpis.totalBornes)} hint={`${kpis.bornesActives} actives`} />
        <StatCard icon={<CheckCircleOutlined />} label="Sessions aujourd'hui" value={String(kpis.sessionsAujourdhui)} hint="Toutes bornes confondues" />
        <StatCard icon={<HistoryOutlined />} label="Énergie délivrée" value={`${kpis.kwhDelivres.toFixed(1)} kWh`} hint={`Durée moyenne ${kpis.dureeMoyenneMin} min`} />
        <StatCard icon={<WarningOutlined />} label="Bornes indisponibles" value={String(kpis.bornesIndisponibles)} hint="Maintenance / défaut / déconnectée" />
      </div>

      <section className="panel">
        <div className="panel__head">
          <h3>Carte du réseau en temps réel</h3>
          <Link to="/dashboard/bornes">
            Voir tout <ArrowRightOutlined />
          </Link>
        </div>
        <BornesMap bornes={bornes} height={340} />
      </section>

      <div className="admin-dashboard__grid">
        <section className="panel admin-dashboard__chart">
          <div className="panel__head">
            <h3>Énergie délivrée (7 derniers jours)</h3>
          </div>
          <ReactECharts option={chartOption} style={{ height: 280 }} />
        </section>

        <section className="panel admin-dashboard__alerts">
          <div className="panel__head">
            <h3>Alertes récentes</h3>
            <Link to="/dashboard/alertes">
              Voir tout <ArrowRightOutlined />
            </Link>
          </div>
          <ul className="alert-feed">
            {alertes.slice(0, 5).map((a) => (
              <li key={a.id} className={`alert-feed__item alert-feed__item--${a.severite}`}>
                <span className="alert-feed__dot" />
                <div>
                  <p className="alert-feed__message">{a.message}</p>
                  <span className="alert-feed__meta">
                    {a.borne} · {a.date}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="admin-dashboard__grid admin-dashboard__grid--reverse">
        <section className="panel admin-dashboard__table">
          <div className="panel__head">
            <h3>Sessions en cours</h3>
            <Link to="/dashboard/sessions">
              Voir tout <ArrowRightOutlined />
            </Link>
          </div>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Borne</th>
                <th>Énergie</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {sessions
                .filter((s) => s.etat === 'En cours' || s.etat === 'En pause')
                .map((s) => (
                  <tr key={s.id}>
                    <td>{s.utilisateur}</td>
                    <td>{s.borne}</td>
                    <td>{s.energieKwh.toFixed(1)} kWh</td>
                    <td>
                      <StatusTag value={s.etat} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        <section className="panel admin-dashboard__table">
          <div className="panel__head">
            <h3>État du parc de bornes</h3>
            <Link to="/dashboard/bornes">
              Voir tout <ArrowRightOutlined />
            </Link>
          </div>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Borne</th>
                <th>Ville</th>
                <th>Puissance</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {bornes.map((b) => (
                <tr key={b.id}>
                  <td>{b.nom}</td>
                  <td>{b.ville}</td>
                  <td>{b.puissance} kW</td>
                  <td>
                    <StatusTag value={b.etat} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
