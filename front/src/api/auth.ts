import { apiClient } from './client'
import type { AuthUser } from '../types'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/login', payload)
  return data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get('/auth/me')
  return data.user
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email })
}

export async function resetPassword(payload: {
  email: string
  password: string
  password_confirmation: string
  token: string
}): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}
