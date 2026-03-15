import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await authApi.login({ email, password })
      setAuth(data.access_token, data.user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#070b14',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#0d1117', border: '1px solid #253148',
        borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 360,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>OEE Pro</div>
          <div style={{ fontSize: 12, color: '#6b82a0', marginTop: 4 }}>
            Production Intelligence
          </div>
        </div>

        {error && (
          <div style={{
            background: '#ff174422', border: '1px solid #ff174455',
            borderRadius: 6, padding: '10px 14px', color: '#fc8181', fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#a0b0c8', fontWeight: 600 }}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoFocus
            style={{
              background: '#0a0e1a', border: '1px solid #2a3f5f',
              borderRadius: 6, padding: '10px 12px', color: '#e2e8f0',
              fontSize: 14, outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#a0b0c8', fontWeight: 600 }}>
            Mot de passe
          </label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              background: '#0a0e1a', border: '1px solid #2a3f5f',
              borderRadius: 6, padding: '10px 12px', color: '#e2e8f0',
              fontSize: 14, outline: 'none',
            }}
          />
        </div>

        <button
          type="submit" disabled={loading}
          style={{
            background: loading ? '#1a2d4a' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: 7,
            padding: '11px', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div style={{ fontSize: 10, color: '#4a6080', textAlign: 'center' }}>
          admin@oee.local · Admin1234!
        </div>
      </form>
    </div>
  )
}
