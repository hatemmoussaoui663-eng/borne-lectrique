import { useEffect, useState } from 'react'
import { Button, Card, Spin, Typography, Alert, Descriptions, Tag, Table, Collapse } from 'antd'
import { PlayCircleOutlined, StopOutlined, SyncOutlined } from '@ant-design/icons'
import { getSimulatorStatus, startSimulator, stopSimulator } from '../../api/simulator'

const { Title, Paragraph, Text } = Typography

interface TemplateStatistic {
  added: number
  configured: number
  provisioned: number
  started: number
}

interface SimulatorState {
  configuration?: {
    stationTemplateUrls?: { file: string; numberOfStations: number }[]
    supervisionUrls?: string[]
    uiServer?: { options?: { host?: string; port?: number }; type?: string }
  }
  started?: boolean
  templateStatistics?: Record<string, TemplateStatistic>
  version?: string
}

function SimulatorSummary({ state }: { state: SimulatorState }) {
  const templateRows = Object.entries(state.templateStatistics ?? {}).map(([template, stats]) => ({
    key: template,
    template,
    ...stats,
  }))
  const uiServer = state.configuration?.uiServer

  return (
    <>
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="État du processus">
          <Tag color={state.started ? 'success' : 'default'}>
            {state.started ? 'Démarré' : 'Arrêté'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Version du simulateur">{state.version ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Serveur UI">
          {uiServer ? `${uiServer.type ?? '?'} · ${uiServer.options?.host ?? '?'}:${uiServer.options?.port ?? '?'}` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="URL(s) de supervision">
          {state.configuration?.supervisionUrls?.length ? (
            <Text code>{state.configuration.supervisionUrls.join(', ')}</Text>
          ) : (
            '—'
          )}
        </Descriptions.Item>
      </Descriptions>

      {templateRows.length > 0 ? (
        <Table
          size="small"
          pagination={false}
          dataSource={templateRows}
          columns={[
            { title: 'Modèle de station', dataIndex: 'template', key: 'template' },
            { title: 'Configurées', dataIndex: 'configured', key: 'configured' },
            { title: 'Provisionnées', dataIndex: 'provisioned', key: 'provisioned' },
            { title: 'Démarrées', dataIndex: 'started', key: 'started' },
          ]}
        />
      ) : null}
    </>
  )
}

function Simulator() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ connected: boolean; status: string; state: Record<string, unknown>; message?: string | null }>({
    connected: false,
    status: 'idle',
    state: {},
  })

  async function refreshStatus() {
    try {
      setLoading(true)
      const data = await getSimulatorStatus()
      setStatus(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    try {
      setBusy(true)
      const data = await startSimulator()
      setStatus(data)
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    try {
      setBusy(true)
      const data = await stopSimulator()
      setStatus(data)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  return (
    <div className="admin-dashboard">
      <section className="panel">
        <div className="panel__head">
          <div>
            <Title level={3} style={{ margin: 0 }}>Simulateur OCPP</Title>
            <Paragraph style={{ margin: '4px 0 0' }}>
              Pilotage du simulateur de stations de charge à partir du back-office.
            </Paragraph>
          </div>
          <Button icon={<SyncOutlined />} onClick={() => void refreshStatus()} loading={loading}>
            Rafraîchir
          </Button>
        </div>

        <Card style={{ borderRadius: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : (
            <>
              {status.message ? (
                <Alert type="error" message={status.message} style={{ marginBottom: 16 }} />
              ) : null}

              <Alert
                type={status.connected ? 'success' : 'info'}
                message={status.connected ? 'Connexion au simulateur active' : 'Le simulateur n’est pas encore accessible'}
                style={{ marginBottom: 16 }}
              />

              {status.connected ? <SimulatorSummary state={status.state as SimulatorState} /> : null}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => void handleStart()} loading={busy}>
                  Démarrer le simulateur
                </Button>
                <Button danger icon={<StopOutlined />} onClick={() => void handleStop()} loading={busy}>
                  Arrêter le simulateur
                </Button>
              </div>

              <Collapse
                style={{ marginTop: 16 }}
                items={[
                  {
                    key: 'raw',
                    label: 'Données brutes',
                    children: (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(status.state, null, 2)}
                      </pre>
                    ),
                  },
                ]}
              />
            </>
          )}
        </Card>
      </section>
    </div>
  )
}

export default Simulator
