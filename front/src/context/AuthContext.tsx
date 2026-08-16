import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as doLogin, logout as doLogout, fetchCurrentUser } from '../api/auth'
import type { AuthUser, Permissions, PermissionLevel } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  permissions: Permissions
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  /** Does the current user have at least `level` access to `module`? Staff-side modules only — the Client role has its own separate `/me/*` pages. */
  can: (module: string, level?: PermissionLevel) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_USER_KEY = 'auth_user'
const AUTH_PERMISSIONS_KEY = 'auth_permissions'

function getStoredUser(): AuthUser | null {
  const item = localStorage.getItem(AUTH_USER_KEY)
  if (!item) return null

  try {
    return JSON.parse(item) as AuthUser
  } catch {
    return null
  }
}

function getStoredPermissions(): Permissions {
  const item = localStorage.getItem(AUTH_PERMISSIONS_KEY)
  if (!item) return {}

  try {
    return JSON.parse(item) as Permissions
  } catch {
    return {}
  }
}

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, read: 1, full: 2 }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [permissions, setPermissions] = useState<Permissions>(() => getStoredPermissions())
  const [loading, setLoading] = useState<boolean>(Boolean(localStorage.getItem(AUTH_TOKEN_KEY)))
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = useMemo(() => Boolean(user), [user])

  const can = useCallback(
    (module: string, level: PermissionLevel = 'read') => {
      const granted = permissions[module] ?? 'none'
      return LEVEL_RANK[granted] >= LEVEL_RANK[level]
    },
    [permissions],
  )

  const refreshUser = useCallback(async () => {
    try {
      const current = await fetchCurrentUser()
      setUser(current.user)
      setPermissions(current.permissions)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(current.user))
      localStorage.setItem(AUTH_PERMISSIONS_KEY, JSON.stringify(current.permissions))
      setError(null)
    } catch (err) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
      localStorage.removeItem(AUTH_PERMISSIONS_KEY)
      setUser(null)
      setPermissions({})
      setError('Session expirée')
      throw err
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    try {
      const data = await doLogin({ email, password })
      localStorage.setItem(AUTH_TOKEN_KEY, data.token)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
      localStorage.setItem(AUTH_PERMISSIONS_KEY, JSON.stringify(data.permissions))
      setUser(data.user)
      setPermissions(data.permissions)
      setLoading(false)
      setError(null)
      navigate(data.user.role_slug === 'client' ? '/client' : '/dashboard')
    } catch (err: unknown) {
      setError('Impossible de se connecter')
      setLoading(false)
      throw err
    }
  }, [navigate])

  const logout = useCallback(async () => {
    try {
      await doLogout()
    } catch {
      // ignore logout errors and still clear local state
    }
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_PERMISSIONS_KEY)
    setUser(null)
    setPermissions({})
    navigate('/login')
  }, [navigate])

  useEffect(() => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
      setLoading(false)
      return
    }

    refreshUser()
      .catch(() => {
        setError('Session expirée')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [refreshUser])

  const value = useMemo(
    () => ({ user, permissions, loading, error, isAuthenticated, login, logout, refreshUser, can }),
    [can, error, isAuthenticated, loading, login, logout, permissions, refreshUser, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
