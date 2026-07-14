import type { ReactNode } from 'react'
import './StatCard.css'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">{value}</span>
        {hint && <span className="stat-card__hint">{hint}</span>}
      </div>
    </div>
  )
}

export default StatCard
