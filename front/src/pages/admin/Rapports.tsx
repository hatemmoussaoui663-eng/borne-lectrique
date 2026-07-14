import ReactECharts from 'echarts-for-react'
import { Button } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { bornes, consumptionSeries, sessions, usageByConnector } from '../../mock/data'

function Rapports() {
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
          itemStyle: { color: ['#6fe45c', '#3fae63', '#1e5a37'][i] },
        })),
      },
    ],
  }

  const topBornes = [...bornes]
    .map((b) => ({
      nom: b.nom,
      sessions: sessions.filter((s) => s.borne === b.nom).length,
      kwh: sessions.filter((s) => s.borne === b.nom).reduce((sum, s) => sum + s.energieKwh, 0),
    }))
    .sort((a, b) => b.kwh - a.kwh)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>Consommation, disponibilité et usage du réseau.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button icon={<DownloadOutlined />}>Exporter PDF</Button>
          <Button icon={<DownloadOutlined />}>Exporter Excel</Button>
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
    </div>
  )
}

export default Rapports
