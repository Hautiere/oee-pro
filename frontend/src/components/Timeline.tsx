import { useRef, useState, useEffect } from 'react'

const EVENT_COLORS: Record<string, string> = {
  running: '#00e676', idle: '#ffd600', down: '#ff1744', maint: '#ff9100',
}
const EVENT_LABELS: Record<string, string> = {
  running: 'Production', idle: 'Idle', down: 'Breakdown', maint: 'Maintenance',
}

interface TimelineEvent {
  id: string; event_type: string; started_at: string; ended_at: string | null
  quality_pct: number; note?: string | null; planned?: boolean
}
interface PlannedMaint {
  id: string; planned_date: string; duration_min: number; maint_type: string; reason?: string | null
}
interface Props { events: TimelineEvent[]; planned: PlannedMaint[]; days?: number }

function fmtDur(m: number) {
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}min`
}

export default function Timeline({ events, planned, days = 14 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(800)
  const [hover, setHover] = useState<any>(null)

  useEffect(() => {
    const obs = new ResizeObserver(e => setW(e[0].contentRect.width || 800))
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Calcul fenêtre dynamique depuis les événements réels ──────────────────
  const allStarts = events.filter(e => e.ended_at).map(e => new Date(e.started_at).getTime())
  const allEnds   = events.filter(e => e.ended_at).map(e => new Date(e.ended_at!).getTime())

  let base: Date, endMs: number

  if (allStarts.length > 0) {
    // Fenêtre = du premier au dernier événement réel, minimum `days` jours
    const minTs = Math.min(...allStarts)
    const maxTs = Math.max(...allEnds)
    const span  = maxTs - minTs
    const minSpan = days * 24 * 3600000
    base  = new Date(minTs)
    endMs = minTs + Math.max(span, minSpan)
  } else {
    // Fallback : fenêtre glissante sur `days` jours depuis maintenant
    const now = Date.now()
    base  = new Date(now - days * 24 * 3600000)
    endMs = now
  }

  const totalMs = endMs - base.getTime()
  const H_ROW = 32, GAP = 8, PAD_L = 52
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
  const xOf   = (ms: number) => PAD_L + ((ms - base.getTime()) / totalMs) * (W - PAD_L - 4)

  // Ticks jours
  const totalDays = Math.ceil(totalMs / 86400000)
  const tickStep  = totalDays <= 14 ? 2 : totalDays <= 30 ? 5 : 7
  const dayTicks  = Array.from({ length: totalDays + 1 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000)
    return {
      x:      xOf(d.getTime()),
      label:  d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      isWeek: d.getDay() === 1,
      show:   i % tickStep === 0,
    }
  })

  // Filtrer les événements dans la fenêtre
  const filteredEvents = events.filter(e =>
    e.ended_at &&
    new Date(e.ended_at).getTime() > base.getTime() &&
    new Date(e.started_at).getTime() < endMs
  )

  const pmEvents = planned.map(pm => {
    const start = new Date(pm.planned_date)
    const end   = new Date(start.getTime() + pm.duration_min * 60000)
    return { id:'pm-'+pm.id, event_type:pm.maint_type, started_at:start.toISOString(), ended_at:end.toISOString(), quality_pct:0, note:pm.reason, planned:true }
  }).filter(e => new Date(e.ended_at!).getTime() > base.getTime() && new Date(e.started_at).getTime() < endMs)

  const svgH = H_ROW * 2 + GAP + 24

  if (filteredEvents.length === 0 && pmEvents.length === 0) {
    return (
      <div ref={containerRef} style={{ width:'100%' }}>
        <div style={{ background:'#0a0f1e', borderRadius:8, padding:'32px 0', textAlign:'center', color:'#6b82a0', fontSize:11 }}>
          Aucun événement dans cette période — lancer le simulateur pour générer des données
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ width:'100%' }}>
      <svg width={W} height={svgH + 4} style={{ display:'block', fontFamily:'monospace' }}>
        <rect width={W} height={svgH + 4} fill="#0a0f1e" rx={8} />
        {dayTicks.map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} y1={0} x2={tk.x} y2={svgH} stroke={tk.isWeek ? '#253148' : '#1a2840'} strokeWidth={tk.isWeek ? 2 : 0.5} />
            {tk.show && <text x={tk.x + 2} y={svgH - 4} fill="#6b82a0" fontSize={9}>{tk.label}</text>}
          </g>
        ))}
        <text x={4} y={H_ROW / 2 + 5} fill="#a0b0c8" fontSize={9} fontWeight={700}>ACTUAL</text>
        <text x={4} y={H_ROW + GAP + H_ROW / 2 + 5} fill="#ff9100" fontSize={9} fontWeight={700}>PLANNED</text>

        {filteredEvents.map(e => {
          const x1  = clamp(xOf(new Date(e.started_at).getTime()), PAD_L, W - 4)
          const x2  = clamp(xOf(new Date(e.ended_at!).getTime()), PAD_L, W - 4)
          const w   = Math.max(2, x2 - x1)
          const col = EVENT_COLORS[e.event_type] ?? '#4a5568'
          const isH = hover?.id === e.id
          return (
            <g key={e.id} onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)} style={{ cursor:'pointer' }}>
              <rect x={x1} y={2} width={w} height={H_ROW - 4} fill={col} opacity={0.85} rx={2} stroke={isH ? '#fff' : 'none'} strokeWidth={1.5} />
              {w > 36 && <text x={x1 + 4} y={H_ROW / 2 + 4} fill="#000" fontSize={9} fontWeight={700} style={{ pointerEvents:'none' }}>{EVENT_LABELS[e.event_type]}</text>}
            </g>
          )
        })}

        {pmEvents.map(e => {
          const x1  = clamp(xOf(new Date(e.started_at).getTime()), PAD_L, W - 4)
          const x2  = clamp(xOf(new Date(e.ended_at!).getTime()), PAD_L, W - 4)
          const w   = Math.max(2, x2 - x1)
          const col = EVENT_COLORS[e.event_type] ?? '#ff9100'
          const isH = hover?.id === e.id
          return (
            <g key={e.id} onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)} style={{ cursor:'pointer' }}>
              <rect x={x1} y={H_ROW + GAP + 2} width={w} height={H_ROW - 4} fill={col} opacity={0.5} rx={2} stroke={isH ? '#fff' : 'none'} strokeWidth={1.5} />
            </g>
          )
        })}

        {hover && (() => {
          const hx  = clamp(xOf(new Date(hover.started_at).getTime()), PAD_L, W - 170)
          const hy  = hover.planned ? H_ROW + GAP : 0
          const dur = hover.ended_at ? Math.round((new Date(hover.ended_at).getTime() - new Date(hover.started_at).getTime()) / 60000) : null
          const col = EVENT_COLORS[hover.event_type] ?? '#4a5568'
          return (
            <g>
              <rect x={hx} y={hy - 58} width={164} height={52} fill="#0d1117" rx={6} stroke={col} strokeWidth={1.5} />
              <text x={hx + 8} y={hy - 42} fill={col} fontSize={11} fontWeight={700}>{EVENT_LABELS[hover.event_type] ?? hover.event_type}</text>
              <text x={hx + 8} y={hy - 28} fill="#e2e8f0" fontSize={9}>{hover.started_at.slice(0,16).replace('T',' ')}</text>
              {dur !== null && <text x={hx + 8} y={hy - 14} fill="#a0b0c8" fontSize={9}>Durée : {fmtDur(dur)}</text>}
            </g>
          )
        })()}
      </svg>
      <div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'wrap' }}>
        {Object.entries(EVENT_LABELS).map(([k, v]) => (
          <span key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#a0b0c8', fontWeight:600 }}>
            <span style={{ width:14, height:10, background:EVENT_COLORS[k], borderRadius:3, display:'inline-block', opacity:0.85 }} />{v}
          </span>
        ))}
      </div>
    </div>
  )
}
