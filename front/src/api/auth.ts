import { apiClient } from './client'
import type { AuthUser, Permissions } from '../types'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
  permissions: Permissions
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/login', payload)
  return data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export interface CurrentUser {
  user: AuthUser
  permissions: Permissions
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await apiClient.get('/auth/me')
  return data
}

/**
 * Le compte peut etre designe par son email ou par son numero de telephone ;
 * l'API en deduit le canal d'envoi (email ou SMS).
 */
export type IdentifiantRecuperation = { email: string } | { phone: string }

export async function forgotPassword(identifiant: IdentifiantRecuperation): Promise<void> {
  await apiClient.post('/auth/forgot-password', identifiant)
}

export async function resetPassword(payload: {
  email: string
  password: string
  password_confirmation: string
  token: string
}): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}
