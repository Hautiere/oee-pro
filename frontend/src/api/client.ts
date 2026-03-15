import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Injecter le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('oee_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Rediriger vers /login si token expiré
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('oee_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
