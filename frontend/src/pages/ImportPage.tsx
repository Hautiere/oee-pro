import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

interface ImportStatus {
  configuration: {
    sites: number
    buildings: number
    machines: number
  }
  data: {
    events: number
  }
  pending_imports: number
}

export default function ImportPage() {
  const navigate = useNavigate()
  const { user, setAuth, logout } = useAuthStore()
  const queryClient = useQueryClient()

  const [configFile, setConfigFile] = useState<File | null>(null)
  const [dataFile, setDataFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  const { data: me, isError, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: status } = useQuery<ImportStatus>({
    queryKey: ['import-status'],
    queryFn: () => fetch('/api/v1/imports/status').then(r => r.json()),
    staleTime: 30 * 1000,
  })

  // Sync user dans le store
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

  const importConfigMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/v1/config/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('oee_token')}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Erreur d\'import')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-status'] })
      setConfigFile(null)
      setUploadProgress('Configuration importée avec succès !')
    },
    onError: (error: Error) => {
      setUploadProgress(`Erreur : ${error.message}`)
    },
  })

  const importDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/v1/data/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('oee_token')}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Erreur d\'import')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-status'] })
      setDataFile(null)
      setUploadProgress('Données importées avec succès !')
    },
    onError: (error: Error) => {
      setUploadProgress(`Erreur : ${error.message}`)
    },
  })

  const autoImportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/data/auto-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('oee_token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Erreur d\'import automatique')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['import-status'] })
      setUploadProgress(`${data.message} (${data.processed} fichiers traités)`)
    },
    onError: (error: Error) => {
      setUploadProgress(`Erreur : ${error.message}`)
    },
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const currentUser = me ?? user

  const handleConfigImport = () => {
    if (configFile) {
      setUploadProgress('Import de la configuration en cours...')
      importConfigMutation.mutate(configFile)
    }
  }

  const handleDataImport = () => {
    if (dataFile) {
      setUploadProgress('Import des données en cours...')
      importDataMutation.mutate(dataFile)
    }
  }

  const handleAutoImport = () => {
    setUploadProgress('Import automatique en cours...')
    autoImportMutation.mutate()
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
                background: '#f6ad55' + '22',
                color: '#f6ad55',
                border: `1px solid #f6ad55` + '44',
              }}>
                {currentUser.role}
              </span>
            </>
          )}
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: '1px solid #2a3f5f', borderRadius: 5,
            color: '#6b82a0', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}>
            ← Retour
          </button>
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid #2a3f5f', borderRadius: 5,
            color: '#6b82a0', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          Import de données
        </h1>
        <p style={{ color: '#6b82a0', fontSize: 13, marginBottom: 32 }}>
          Configurez votre application en important des fichiers JSON
        </p>

        {/* Statut actuel */}
        {status && (
          <div style={{
            marginBottom: 32, background: '#0d1117',
            border: '1px solid #253148', borderRadius: 10, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 11, color: '#6b82a0', fontWeight: 700, marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Statut actuel
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6b82a0', marginBottom: 4 }}>Sites</div>
                <div style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>{status.configuration.sites}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b82a0', marginBottom: 4 }}>Bâtiments</div>
                <div style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>{status.configuration.buildings}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b82a0', marginBottom: 4 }}>Machines</div>
                <div style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>{status.configuration.machines}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b82a0', marginBottom: 4 }}>Événements</div>
                <div style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>{status.data.events}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b82a0', marginBottom: 4 }}>Fichiers en attente</div>
                <div style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>{status.pending_imports}</div>
              </div>
            </div>
          </div>
        )}

        {/* Import configuration */}
        <div style={{
          marginBottom: 24, background: '#0d1117',
          border: '1px solid #253148', borderRadius: 10, padding: '24px',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e2e8f0' }}>
            📁 Configuration d'usine
          </h3>
          <p style={{ color: '#6b82a0', fontSize: 13, marginBottom: 16 }}>
            Importez la structure de votre usine (sites, bâtiments, machines).
            <br />
            <strong>Attention :</strong> Cela remplace la configuration existante.
          </p>

          <div style={{ marginBottom: 16 }}>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setConfigFile(e.target.files?.[0] || null)}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 6,
                color: '#e2e8f0',
                padding: '8px 12px',
                width: '100%',
                marginBottom: 12,
              }}
            />
            {configFile && (
              <div style={{ fontSize: 12, color: '#6b82a0', marginBottom: 12 }}>
                Fichier sélectionné : {configFile.name}
              </div>
            )}
          </div>

          <button
            onClick={handleConfigImport}
            disabled={!configFile || importConfigMutation.isPending}
            style={{
              background: configFile ? '#238636' : '#30363d',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: configFile ? 'pointer' : 'not-allowed',
              opacity: configFile ? 1 : 0.6,
            }}
          >
            {importConfigMutation.isPending ? 'Import en cours...' : 'Importer configuration'}
          </button>
        </div>

        {/* Import données */}
        <div style={{
          marginBottom: 24, background: '#0d1117',
          border: '1px solid #253148', borderRadius: 10, padding: '24px',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e2e8f0' }}>
            📊 Données historiques
          </h3>
          <p style={{ color: '#6b82a0', fontSize: 13, marginBottom: 16 }}>
            Importez des données d'événements machine depuis vos systèmes SCADA/PLC.
            <br />
            Les données sont ajoutées sans remplacer les existantes.
          </p>

          <div style={{ marginBottom: 16 }}>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setDataFile(e.target.files?.[0] || null)}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 6,
                color: '#e2e8f0',
                padding: '8px 12px',
                width: '100%',
                marginBottom: 12,
              }}
            />
            {dataFile && (
              <div style={{ fontSize: 12, color: '#6b82a0', marginBottom: 12 }}>
                Fichier sélectionné : {dataFile.name}
              </div>
            )}
          </div>

          <button
            onClick={handleDataImport}
            disabled={!dataFile || importDataMutation.isPending}
            style={{
              background: dataFile ? '#238636' : '#30363d',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: dataFile ? 'pointer' : 'not-allowed',
              opacity: dataFile ? 1 : 0.6,
            }}
          >
            {importDataMutation.isPending ? 'Import en cours...' : 'Importer données'}
          </button>
        </div>

        {/* Import automatique */}
        <div style={{
          marginBottom: 24, background: '#0d1117',
          border: '1px solid #253148', borderRadius: 10, padding: '24px',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e2e8f0' }}>
            🔄 Import automatique
          </h3>
          <p style={{ color: '#6b82a0', fontSize: 13, marginBottom: 16 }}>
            Traite automatiquement tous les fichiers JSON du dossier <code>data/incoming/</code>.
            <br />
            Les fichiers traités sont déplacés vers <code>data/archive/</code>.
          </p>

          <button
            onClick={handleAutoImport}
            disabled={autoImportMutation.isPending}
            style={{
              background: '#238636',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {autoImportMutation.isPending ? 'Traitement en cours...' : 'Lancer import automatique'}
          </button>
        </div>

        {/* Messages de progression */}
        {uploadProgress && (
          <div style={{
            padding: 16,
            borderRadius: 6,
            background: uploadProgress.includes('Erreur') ? '#da3633' + '22' : '#238636' + '22',
            border: `1px solid ${uploadProgress.includes('Erreur') ? '#da3633' : '#238636'}44`,
            color: uploadProgress.includes('Erreur') ? '#da3633' : '#238636',
            fontSize: 13,
            fontWeight: 600,
          }}>
            {uploadProgress}
          </div>
        )}

        {/* Liens vers exemples */}
        <div style={{
          marginTop: 32, background: '#0d1117',
          border: '1px solid #253148', borderRadius: 10, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: '#6b82a0', fontWeight: 700, marginBottom: 12,
            textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Fichiers d'exemple
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <a
              href="/config_examples/config_fr.json"
              download
              style={{ color: '#58a6ff', textDecoration: 'none', fontSize: 13 }}
            >
              📁 Configuration française
            </a>
            <a
              href="/config_examples/config_en.json"
              download
              style={{ color: '#58a6ff', textDecoration: 'none', fontSize: 13 }}
            >
              📁 Configuration anglaise
            </a>
            <a
              href="/data_examples/sample_data_2024-01-01_2024-01-07.json"
              download
              style={{ color: '#58a6ff', textDecoration: 'none', fontSize: 13 }}
            >
              📊 Données exemple (1 semaine)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}