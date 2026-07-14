import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as doLogin, logout as doLogout, fetchCurrentUser } from '../api/auth'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_USER_KEY = 'auth_user'

function getStoredUser(): AuthUser | null {
  const item = localStorage.getItem(AUTH_USER_KEY)
  if (!item) return null

  try {
    return JSON.parse(item) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [loading, setLoading] = useState<boolean>(Boolean(localStorage.getItem(AUTH_TOKEN_KEY)))
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = useMemo(() => Boolean(user), [user])

  const refreshUser = useCallback(async () => {
    try {
      const fetchedUser = await fetchCurrentUser()
      setUser(fetchedUser)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fetchedUser))
      setError(null)
    } catch (err) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
      setUser(null)
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
      setUser(data.user)
      setLoading(false)
      setError(null)
      navigate('/dashboard')
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
    setUser(null)
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
    () => ({ user, loading, error, isAuthenticated, login, logout, refreshUser }),
    [error, isAuthenticated, loading, login, logout, refreshUser, user],
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
