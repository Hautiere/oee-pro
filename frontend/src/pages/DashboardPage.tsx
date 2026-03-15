import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, setAuth, logout } = useAuthStore()

  const { data: me, isError, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // Sync user dans le store dès que /me répond
  useEffect(() => {
    if (me) setAuth(localStorage.getItem('oee_token') ?? '', me)
  }, [me])

  // Token invalide → redirect login
  useEffect(() => {
    if (isError) {
      logout()
      navigate('/login')
    }
  }, [isError])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const currentUser = me ?? user

  const roleColor: Record<string, string> = {
    admin:       '#f6ad55',
    supervisor:  '#63b3ed',
    maintenance: '#68d391',
    operator:    '#a0b0c8',
  }

  if (isLoading && !currentUser) {
    return (
      <div style={{
        minHeight: '100vh', background: '#070b14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: '#6b82a0', fontSize: 14 }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070b14', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#0a0e1a', borderBottom: '1px solid #1a2840',
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.02em' }}>
          OEE Pro
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {currentUser && (
            <>
              <span style={{ fontSize: 12, color: '#a0b0c8' }}>
                {currentUser.full_name}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: (roleColor[currentUser.role] ?? '#a0b0c8') + '22',
                color: roleColor[currentUser.role] ?? '#a0b0c8',
                border: `1px solid ${(roleColor[currentUser.role] ?? '#a0b0c8')}44`,
              }}>
                {currentUser.role}
              </span>
            </>
          )}
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid #2a3f5f', borderRadius: 5,
            color: '#6b82a0', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          Tableau de bord
        </h1>
        <p style={{ color: '#6b82a0', fontSize: 13, marginBottom: 32 }}>
          Phase 1 ✅ — Socle opérationnel
          {currentUser && ` · Connecté en tant que ${currentUser.full_name}`}
        </p>

        {/* Statuts phases */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}>
          {[
            { label: 'Backend FastAPI',  status: '✓ ok',    color: '#00e676' },
            { label: 'PostgreSQL',       status: '✓ ok',    color: '#00e676' },
            { label: 'Auth JWT',         status: '✓ ok',    color: '#00e676' },
            { label: 'Référentiel',      status: 'phase 2', color: '#ff9100' },
            { label: 'Événements',       status: 'phase 3', color: '#4a5568' },
            { label: 'Calcul OEE',       status: 'phase 4', color: '#4a5568' },
          ].map((item) => (
            <div key={item.label} style={{
              background: '#0d1117',
              border: `1px solid ${item.color}33`,
              borderRadius: 10, padding: '18px 20px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                {item.label}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: item.color + '22', color: item.color,
                border: `1px solid ${item.color}44`,
              }}>
                {item.status}
              </span>
            </div>
          ))}
        </div>

        {/* Info utilisateur connecté */}
        {currentUser && (
          <div style={{
            marginTop: 32, background: '#0d1117',
            border: '1px solid #253148', borderRadius: 10, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 11, color: '#6b82a0', fontWeight: 700, marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Session active
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Nom',   value: currentUser.full_name },
                { label: 'Email', value: currentUser.email },
                { label: 'Rôle',  value: currentUser.role },
                { label: 'ID',    value: currentUser.id.slice(0, 8) + '…' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, color: '#6b82a0', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
