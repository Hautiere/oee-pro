export const STATUS_CONFIG = {
  running:  { label: 'Running',     color: '#00e676' },
  idle:     { label: 'Idle',        color: '#ffd600' },
  down:     { label: 'Down',        color: '#ff1744' },
  maint:    { label: 'Maintenance', color: '#ff9100' },
  inactive: { label: 'Inactive',    color: '#4a5568' },
} as const

export const EVENT_CONFIG = {
  running: { label: 'Production',  color: '#00e676' },
  idle:    { label: 'Idle',        color: '#ffd600' },
  down:    { label: 'Breakdown',   color: '#ff1744' },
  maint:   { label: 'Maintenance', color: '#ff9100' },
} as const

export const oeeColor = (v: number) => v >= 0.85 ? '#00e676' : v >= 0.65 ? '#ff9100' : '#ff1744'
export const pct      = (v: number) => `${Math.round(v * 100)}%`
export const fmtDur   = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}min`
export const clamp    = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export interface OEEEvent {
  event_type: string; started_at: string; ended_at: string | null; quality_pct: number
}
export interface WeeklyOEE { date: string; A: number; P: number; Q: number; TRS: number }

export function calcWeeklyOEE(events: OEEEvent[]): WeeklyOEE[] {
  const validEvents = events.filter(e => e.ended_at)
  if (!validEvents.length) return []

  const weeks: Record<string, {
    running: number; idle: number; down: number; maint: number
    goodMins: number; totalRunMins: number
  }> = {}

  validEvents.forEach(e => {
    const d  = new Date(e.started_at)
    // Semaine ISO — lundi
    const ws = new Date(d)
    ws.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    ws.setHours(0, 0, 0, 0)
    const wk = ws.toISOString().slice(0, 10)

    if (!weeks[wk]) weeks[wk] = { running:0, idle:0, down:0, maint:0, goodMins:0, totalRunMins:0 }

    const mins = (new Date(e.ended_at!).getTime() - new Date(e.started_at).getTime()) / 60000
    const t    = e.event_type as 'running'|'idle'|'down'|'maint'
    if (t in weeks[wk]) weeks[wk][t] += mins

    if (e.event_type === 'running') {
      weeks[wk].totalRunMins += mins
      weeks[wk].goodMins     += mins * (e.quality_pct ?? 90) / 100
    }
  })

  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, w]) => {
      const total = w.running + w.idle + w.down + w.maint
      if (!total) return null
      const avail = Math.max(0, total - w.down - w.maint)
      const A = clamp(avail / total, 0, 1)
      const P = clamp(avail > 0 ? w.running / avail : 0, 0, 1)
      const Q = clamp(w.totalRunMins > 0 ? w.goodMins / w.totalRunMins : 0, 0, 1)
      return { date, A, P, Q, TRS: A * P * Q }
    })
    .filter(Boolean) as WeeklyOEE[]
}
