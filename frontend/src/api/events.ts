import api from './client'

export type EventType = 'running' | 'idle' | 'down' | 'maint'
export type MaintType = 'maint' | 'down' | 'idle'

export interface MachineEventOut {
  id: string
  machine_id: string
  event_type: EventType
  started_at: string
  ended_at: string | null
  quality_pct: number
  note: string | null
  created_at: string
  duration_min: number | null
  interventions: InterventionOut[]
}

export interface InterventionOut {
  id: string
  event_id: string
  machine_id: string
  cause: string | null
  action: string | null
  technician: string | null
  duration_min: number | null
  created_at: string
}

export interface PlannedMaintenanceOut {
  id: string
  machine_id: string
  planned_date: string
  duration_min: number
  maint_type: MaintType
  reason: string | null
  is_done: boolean
  created_at: string
}

export interface TimelineResponse {
  machine_id: string
  events: MachineEventOut[]
  planned: PlannedMaintenanceOut[]
}

export interface EventCreate {
  event_type: EventType
  started_at: string
  ended_at?: string
  quality_pct?: number
  note?: string
}

export interface PlannedCreate {
  planned_date: string
  duration_min: number
  maint_type?: MaintType
  reason?: string
}

export const eventsApi = {
  getTimeline: async (machineId: string, days = 14): Promise<TimelineResponse> => {
    const { data } = await api.get(`/machines/${machineId}/timeline?days=${days}`)
    return data
  },

  createEvent: async (machineId: string, payload: EventCreate): Promise<MachineEventOut> => {
    const { data } = await api.post(`/machines/${machineId}/events`, payload)
    return data
  },

  updateEvent: async (eventId: string, payload: Partial<EventCreate>): Promise<MachineEventOut> => {
    const { data } = await api.put(`/events/${eventId}`, payload)
    return data
  },

  deleteEvent: async (eventId: string): Promise<void> => {
    await api.delete(`/events/${eventId}`)
  },

  createPlanned: async (machineId: string, payload: PlannedCreate): Promise<PlannedMaintenanceOut> => {
    const { data } = await api.post(`/machines/${machineId}/planned-maintenance`, payload)
    return data
  },

  deletePlanned: async (pmId: string): Promise<void> => {
    await api.delete(`/planned-maintenance/${pmId}`)
  },
}
