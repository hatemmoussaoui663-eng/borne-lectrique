import { useState, type ReactNode } from 'react'
import { Button, Select, Tag } from 'antd'
import { CheckOutlined, WarningOutlined, InfoCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { alertes as initialAlertes } from '../../mock/data'
import type { Alerte, AlerteSeverite } from '../../types'

const severityMeta: Record<AlerteSeverite, { label: string; color: string; icon: ReactNode }> = {
  critical: { label: 'Critique', color: 'error', icon: <ExclamationCircleOutlined /> },
  warning: { label: 'Avertissement', color: 'gold', icon: <WarningOutlined /> },
  info: { label: 'Information', color: 'default', icon: <InfoCircleOutlined /> },
}

function Alertes() {
  const [items, setItems] = useState<Alerte[]>(initialAlertes)
  const [severityFilter, setSeverityFilter] = useState<AlerteSeverite | undefined>()

  const filtered = items.filter((a) => !severityFilter || a.severite === severityFilter)

  function markAsRead(id: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, lue: true } : a)))
  }

  return (
    <div>
      <div className="page-toolbar">
        <Select
          placeholder="Filtrer par sévérité"
          style={{ width: 200 }}
          allowClear
          value={severityFilter}
          onChange={setSeverityFilter}
          options={Object.entries(severityMeta).map(([value, meta]) => ({ label: meta.label, value }))}
        />
        <Button
          onClick={() => setItems((prev) => prev.map((a) => ({ ...a, lue: true })))}
        >
          Tout marquer comme lu
        </Button>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {filtered.map((a, i) => {
          const meta = severityMeta[a.severite]
          return (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 22px',
                borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border)',
                opacity: a.lue ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--bg-surface-alt)',
                  color:
                    a.severite === 'critical' ? '#ff6b6b' : a.severite === 'warning' ? '#f5b545' : 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                {meta.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14 }}>{a.message}</p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {a.borne} · {a.date}
                </span>
              </div>
              <Tag color={meta.color}>{meta.label}</Tag>
              {!a.lue && (
                <Button size="small" icon={<CheckOutlined />} onClick={() => markAsRead(a.id)}>
                  Marquer comme lu
                </Button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p style={{ padding: 22 }}>Aucune alerte pour ce filtre.</p>
        )}
      </div>
    </div>
  )
}

export default Alertes
