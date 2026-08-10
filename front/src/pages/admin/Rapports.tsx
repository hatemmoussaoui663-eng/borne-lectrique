import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { getSessions } from '../../api/sessions'
import { apiClient } from '../../api/client'
import { exportSessionsCsv } from '../../api/rapports'
import type { ChargeSession, ConnecteurType } from '../../types'

interface BorneWithConnecteurs {
  nom: string
  connecteurs: { id: string; type: ConnecteurType }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBorne(item: any): BorneWithConnecteurs {
  return {
    nom: item.nom ?? item.name ?? '',
    connecteurs: (item.connecteurs ?? []).map((c: { id: string; type: ConnecteurType }) => ({
      id: String(c.id),
      type: c.type,
    })),
  }
}

function Rapports() {
  const [sessions, setSessions] = useState<ChargeSession[]>([])
  const [bornes, setBornes] = useState<BorneWithConnecteurs[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [sessionsData, bornesRes] = await Promise.all([getSessions(), apiClient.get('/bornes')])
        setSessions(sessionsData)
        setBornes((bornesRes.data ?? []).map(normalizeBorne))
      } catch {
        message.error('Impossible de charger les données de rapports depuis le backend.')
      }
    }
    void load()
  }, [])

  async function handleExportCsv() {
    try {
      setExporting(true)
      await exportSessionsCsv()
    } catch {
      message.error("Échec de l'export CSV.")
    } finally {
      setExporting(false)
    }
  }

  const consumptionSeries = useMemo(() => {
    const days: string[] = []
    const byDay = new Map<string, number>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push(key)
      byDay.set(key, 0)
    }
    for (const s of sessions) {
      if (!s.debut) continue
      const key = s.debut.slice(0, 10)
      if (byDay.has(key)) {
        byDay.set(key, (byDay.get(key) ?? 0) + s.energieKwh)
      }
    }
    return {
      days: days.map((d) => d.slice(5)),
      kwh: days.map((d) => Number((byDay.get(d) ?? 0).toFixed(2))),
    }
  }, [sessions])

  const usageByConnector = useMemo(() => {
    const typeByBorneAndConnector = new Map<string, ConnecteurType>()
    for (const b of bornes) {
      for (const c of b.connecteurs) {
        typeByBorneAndConnector.set(`${b.nom}::${c.id}`, c.type)
      }
    }

    const totals = new Map<string, number>()
    for (const s of sessions) {
      const type = typeByBorneAndConnector.get(`${s.borne}::${s.connecteur}`) ?? 'AC'
      totals.set(type, (totals.get(type) ?? 0) + s.energieKwh)
    }

    return [...totals.entries()].map(([type, value]) => ({ type, value: Number(value.toFixed(2)) }))
  }, [sessions, bornes])

  const topBornes = useMemo(() => {
    const byBorne = new Map<string, { sessions: number; kwh: number }>()
    for (const s of sessions) {
      const entry = byBorne.get(s.borne) ?? { sessions: 0, kwh: 0 }
      entry.sessions += 1
      entry.kwh += s.energieKwh
      byBorne.set(s.borne, entry)
    }
    return [...byBorne.entries()]
      .map(([nom, v]) => ({ nom, ...v }))
      .sort((a, b) => b.kwh - a.kwh)
  }, [sessions])

  const topClients = useMemo(() => {
    const byClient = new Map<string, { sessions: number; kwh: number; prix: number }>()
    for (const s of sessions) {
      if (!s.utilisateur) continue
      const entry = byClient.get(s.utilisateur) ?? { sessions: 0, kwh: 0, prix: 0 }
      entry.sessions += 1
      entry.kwh += s.energieKwh
      entry.prix += s.prix
      byClient.set(s.utilisateur, entry)
    }
    return [...byClient.entries()]
      .map(([nom, v]) => ({ nom, ...v }))
      .sort((a, b) => b.kwh - a.kwh)
      .slice(0, 10)
  }, [sessions])

  const consumptionOption = {
    grid: { left: 44, right: 16, top: 24, bottom: 30 },
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
        type: 'bar',
        barWidth: '46%',
        itemStyle: { color: '#6fe45c', borderRadius: [6, 6, 0, 0] },
      },
    ],
  }

  const connectorOption = {
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      textStyle: { color: '#a9bcac' },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '75%'],
        itemStyle: { borderColor: '#0f2417', borderWidth: 3 },
        label: { show: false },
        labelLine: { show: false },
        data: usageByConnector.map((u, i) => ({
          name: u.type,
          value: u.value,
          itemStyle: { color: ['#6fe45c', '#3fae63', '#1e5a37', '#a3d9a5', '#0f7a3f'][i % 5] },
        })),
      },
    ],
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>Consommation, disponibilité et usage du réseau.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExportCsv()}>
            Exporter CSV (sessions)
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => message.info('Export PDF à venir.')}>
            Exporter PDF
          </Button>
        </div>
      </div>

      <div className="report-grid">
        <section className="panel">
          <div className="panel__head">
            <h3>Énergie délivrée par jour</h3>
          </div>
          <ReactECharts option={consumptionOption} style={{ height: 300 }} />
        </section>

        <section className="panel">
          <div className="panel__head">
            <h3>Répartition par type de connecteur</h3>
          </div>
          <ReactECharts option={connectorOption} style={{ height: 300 }} />
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h3>Top bornes (par énergie délivrée)</h3>
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Borne</th>
              <th>Sessions</th>
              <th>Énergie délivrée</th>
            </tr>
          </thead>
          <tbody>
            {topBornes.map((b) => (
              <tr key={b.nom}>
                <td>{b.nom}</td>
                <td>{b.sessions}</td>
                <td>{b.kwh.toFixed(1)} kWh</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h3>Top clients (par énergie consommée)</h3>
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Sessions</th>
              <th>Énergie consommée</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {topClients.map((c) => (
              <tr key={c.nom}>
                <td>{c.nom}</td>
                <td>{c.sessions}</td>
                <td>{c.kwh.toFixed(1)} kWh</td>
                <td>{c.prix.toFixed(3)} DT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default Rapports
