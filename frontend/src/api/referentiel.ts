import api from './client'

// ── Types alignés sur les schémas Pydantic backend ───────────────────────────

export type MachineStatus = 'running' | 'idle' | 'down' | 'maint' | 'inactive'

export interface MachineOut {
  id: string
  workshop_id: string
  name: string
  machine_type: string
  machine_function: string
  status: MachineStatus
  serial_number: string | null
  manufacturer: string | null
  year_installed: number | null
  cadence_ref: number
  notes: string | null
  tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkshopOut {
  id: string
  building_id: string
  name: string
  description: string | null
  location: string | null
  responsible: string | null
  oee_threshold_good: number
  oee_threshold_warn: number
  is_active: boolean
  created_at: string
  updated_at: string
  machines: MachineOut[]
}

export interface BuildingOut {
  id: string
  site_id: string
  name: string
  description: string | null
  floors: number | null
  surface: number | null
  manager: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  workshops: WorkshopOut[]
}

export interface SiteOut {
  id: string
  name: string
  description: string | null
  address: string | null
  manager: string | null
  country: string | null
  timezone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  buildings: BuildingOut[]
}

export interface MachineUpdate {
  name?: string
  machine_type?: string
  machine_function?: string
  status?: MachineStatus
  serial_number?: string
  manufacturer?: string
  year_installed?: number
  cadence_ref?: number
  notes?: string
  tags?: string[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const referentielApi = {
  // Arbre complet en une requête — utilisé par le sidebar
  getSitesTree: async (): Promise<SiteOut[]> => {
    const { data } = await api.get<SiteOut[]>('/sites/tree')
    return data
  },

  // Liste machines à plat — utilisé par le module OEE overview
  getAllMachines: async (): Promise<MachineOut[]> => {
    const { data } = await api.get<MachineOut[]>('/machines')
    return data
  },

  // Mise à jour machine (statut, notes, tags…)
  updateMachine: async (id: string, payload: MachineUpdate): Promise<MachineOut> => {
    const { data } = await api.put<MachineOut>(`/machines/${id}`, payload)
    return data
  },

  // Constantes (types, fonctions, statuts)
  getConstants: async () => {
    const { data } = await api.get('/referentiel/constants')
    return data
  },
}
