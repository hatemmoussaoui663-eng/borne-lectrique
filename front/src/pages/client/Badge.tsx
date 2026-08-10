import { useEffect, useState } from 'react'
import { Descriptions, Tag, Spin, Empty } from 'antd'
import { IdcardOutlined } from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'
import type { BadgeStatut } from '../../types'

const statutColor: Record<BadgeStatut, string> = {
  Actif: 'success',
  Bloqué: 'error',
  Expiré: 'default',
}

function ClientBadge() {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshUser()
      .catch(() => {
        // AuthContext already surfaces session-expiry via its own error state
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="panel" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spin />
      </div>
    )
  }

  if (!user?.badge) {
    return (
      <div className="panel">
        <Empty description="Aucun badge RFID associé à votre compte. Contactez un administrateur pour en obtenir un." />
      </div>
    )
  }

  return (
    <div className="panel">
      <Descriptions
        title={
          <span>
            <IdcardOutlined /> Badge RFID
          </span>
        }
        column={1}
        bordered
      >
        <Descriptions.Item label="Numéro">{user.badge.code}</Descriptions.Item>
        <Descriptions.Item label="Statut">
          <Tag color={statutColor[user.badge.status]}>{user.badge.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Expiration">
          {user.badge.expiresAt ?? 'Pas de date d\'expiration'}
        </Descriptions.Item>
      </Descriptions>
    </div>
  )
}

export default ClientBadge
