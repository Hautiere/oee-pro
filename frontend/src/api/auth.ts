import api from './client'

export interface UserOut {
  id: string
  email: string
  full_name: string
  role: 'operator' | 'maintenance' | 'supervisor' | 'admin'
  is_active: boolean
  created_at: string
}

export interface TokenOut {
  access_token: string
  token_type: string
  user: UserOut
}

export interface LoginRequest {
  email: string
  password: string
}

export const authApi = {
  login: async (payload: LoginRequest): Promise<TokenOut> => {
    const { data } = await api.post<TokenOut>('/auth/login', payload)
    return data
  },

  me: async (): Promise<UserOut> => {
    const { data } = await api.get<UserOut>('/auth/me')
    return data
  },
}
