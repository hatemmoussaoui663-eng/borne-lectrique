import { Tag } from 'antd'

const colorMap: Record<string, string> = {
  Disponible: 'success',
  Actif: 'success',
  Terminée: 'success',
  Résolu: 'success',

  Occupée: 'processing',
  'En cours': 'processing',
  Planifié: 'processing',

  Maintenance: 'gold',
  'En pause': 'gold',
  Moyenne: 'gold',

  'Hors service': 'error',
  Défaut: 'error',
  Bloqué: 'error',
  Ouvert: 'error',
  Critique: 'error',

  Haute: 'volcano',

  Déconnectée: 'default',
  Annulée: 'default',
  Expiré: 'default',
  Basse: 'default',
}

function StatusTag({ value }: { value: string }) {
  return <Tag color={colorMap[value] ?? 'default'}>{value}</Tag>
}

export default StatusTag
