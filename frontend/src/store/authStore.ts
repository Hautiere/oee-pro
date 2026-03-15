import { create } from 'zustand'
import type { UserOut } from '../api/auth'

interface AuthState {
  user: UserOut | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (token: string, user: UserOut) => void
  logout: () => void
}

const storedToken = localStorage.getItem('oee_token')

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: storedToken,
  isAuthenticated: !!storedToken,

  setAuth: (token, user) => {
    localStorage.setItem('oee_token', token)
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('oee_token')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))
