import axios from 'axios'

// Base URL for the Laravel REST API (see cahier des charges §3/§4).
// Configure VITE_API_BASE_URL in a .env file once the backend is available.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
