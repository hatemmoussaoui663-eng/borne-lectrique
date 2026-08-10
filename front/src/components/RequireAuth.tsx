import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface RequireAuthProps {
  children: ReactNode
  /** If set, only these role_slug values may access the route; everyone else is sent to `fallback`. */
  roles?: string[]
  fallback?: string
}

function RequireAuth({ children, roles, fallback = '/dashboard' }: RequireAuthProps) {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div>Chargement...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role_slug)) {
    return <Navigate to={fallback} replace />
  }

  return children
}

export default RequireAuth
