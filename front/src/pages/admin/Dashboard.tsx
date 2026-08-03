import { useEffect, useState } from 'react'
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
import { apiClient } from '../../api/client'
import { getDashboard, type DashboardData } from '../../api/dashboard'
import { getAlertes } from '../../api/alertes'
import { getSessions } from '../../api/sessions'
import { echo } from '../../echo'
import type { Alerte, Borne, ChargeSession } from '../../types'
import './Dashboard.css'

const emptyKpis: DashboardData = {
  totalBornes: 0,
  bornesActives: 0,
  bornesIndisponibles: 0,
  sessionsAujourdhui: 0,
  kwhDelivres: 0,
  dureeMoyenneMin: 0,
  consumptionSeries: { days: [], kwh: [] },
}

function upsertById<T extends { id: string }>(list: T[], incoming: T): T[] {
  const index = list.findIndex((item) => item.id === incoming.id)
  if (index === -1) return [incoming, ...list]
  const next = [...list]
  next[index] = incoming
  return next
}

function Dashboard() {
  const [kpis, setKpis] = useState<DashboardData>(emptyKpis)
  const [bornes, setBornes] = useState<Borne[]>([])
  const [sessions, setSessions] = useState<ChargeSession[]>([])
  const [alertes, setAlertes] = useState<Alerte[]>([])

  useEffect(() => {
    void getDashboard().then(setKpis)
    void apiClient.get<Borne[]>('/bornes').then(({ data }) => setBornes(data))
    void getSessions().then(setSessions)
    void getAlertes().then((data) => setAlertes(data.slice(0, 5)))

    const bornesChannel = echo.channel('bornes-updates')
    bornesChannel.listen('.borne.updated', (payload: Borne) => {
      setBornes((current) => upsertById(current, payload))
    })

    const sessionsChannel = echo.channel('sessions-updates')
    sessionsChannel.listen('.session.updated', (payload: ChargeSession) => {
      setSessions((current) => upsertById(current, payload))
    })

    const alertesChannel = echo.channel('alertes-updates')
    alertesChannel.listen('.alerte.updated', (payload: Alerte) => {
      setAlertes((current) => upsertById(current, payload).slice(0, 5))
    })

    return () => {
      echo.leaveChannel('bornes-updates')
      echo.leaveChannel('sessions-updates')
      echo.leaveChannel('alertes-updates')
    }
  }, [])

  const chartOption = {
    grid: { left: 40, right: 16, top: 20, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: kpis.consumptionSeries.days,
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
        data: kpis.consumptionSeries.kwh,
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
            {alertes.map((a) => (
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
            {alertes.length === 0 && <li className="alert-feed__item">Aucune alerte récente.</li>}
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
                <th>Badge</th>
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
                    <td>{s.idTag ?? '—'}</td>
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
                  <td>{b.ville || '—'}</td>
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
