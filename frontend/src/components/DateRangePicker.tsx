import { useState } from 'react'

interface Props {
  startDate: string      // ISO date "YYYY-MM-DD"
  startTime: string      // "HH:MM"
  endDate: string
  endTime: string
  onChange: (s: { startDate:string; startTime:string; endDate:string; endTime:string }) => void
  theme: 'dark' | 'light'
}

const T_DARK = {
  card:'#0d1117', cardBorder:'#253148', cardBg2:'#0a0f1e',
  text:'#e2e8f0', textMuted:'#a0b0c8', textFaint:'#6b82a0',
  input:'#0d1117', inputBorder:'#2a3f5f',
  sel:'#4299e1', selBg:'#1a3358', today:'#1a2840',
}
const T_LIGHT = {
  card:'#ffffff', cardBorder:'#c8d8e8', cardBg2:'#edf2f7',
  text:'#0f1923', textMuted:'#2d4060', textFaint:'#4a6080',
  input:'#ffffff', inputBorder:'#8090a8',
  sel:'#2563eb', selBg:'#bfd4ef', today:'#dde8f5',
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS   = ['Lu','Ma','Me','Je','Ve','Sa','Di']

function isoDate(y:number, m:number, d:number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

export default function DateRangePicker({ startDate, startTime, endDate, endTime, onChange, theme }: Props) {
  const T = theme === 'dark' ? T_DARK : T_LIGHT

  const today = new Date()
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })

  // Sélection en cours : null = rien, 'start' = choix début, 'end' = choix fin
  const [picking, setPicking] = useState<'start'|'end'|null>(null)
  const [hoverDate, setHoverDate] = useState<string|null>(null)

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const firstDay    = (new Date(view.year, view.month, 1).getDay() + 6) % 7 // lundi = 0

  const prevMonth = () => setView(v => v.month === 0 ? {year:v.year-1, month:11} : {...v, month:v.month-1})
  const nextMonth = () => setView(v => v.month === 11 ? {year:v.year+1, month:0} : {...v, month:v.month+1})

  const isInRange = (iso: string) => {
    const s = startDate, e = endDate || hoverDate
    if (!s || !e) return false
    return iso > Math.min(s as any, e as any) && iso < Math.max(s as any, e as any)
  }

  const handleDayClick = (iso: string) => {
    if (!picking || picking === 'start') {
      // Choisir le début
      onChange({ startDate: iso, startTime, endDate: '', endTime })
      setPicking('end')
    } else {
      // Choisir la fin — s'assurer que end >= start
      if (iso < startDate) {
        onChange({ startDate: iso, startTime, endDate: startDate, endTime })
      } else {
        onChange({ startDate, startTime, endDate: iso, endTime })
      }
      setPicking(null)
    }
  }

  const inp = {
    background: T.input, color: T.text, border: `1px solid ${T.inputBorder}`,
    borderRadius: 6, padding: '7px 10px', fontSize: 12,
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  const formatDisplay = (d: string) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Affichage aller/retour style SNCF */}
      <div style={{ display:'flex', gap:8 }}>
        {/* Départ */}
        <button onClick={() => setPicking('start')}
          style={{ flex:1, background:picking==='start'?T.selBg:T.cardBg2, border:`2px solid ${picking==='start'?T.sel:T.cardBorder}`, borderRadius:8, padding:'10px 14px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
          <div style={{ fontSize:8, color:T.textFaint, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:4 }}>🛫 Début</div>
          <div style={{ fontSize:14, fontWeight:700, color:startDate ? T.text : T.textFaint, fontFamily:'monospace' }}>
            {startDate ? formatDisplay(startDate) : 'Choisir…'}
          </div>
          {startDate && <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{startTime}</div>}
        </button>

        {/* Flèche */}
        <div style={{ display:'flex', alignItems:'center', color:T.textFaint, fontSize:18, padding:'0 4px' }}>→</div>

        {/* Arrivée */}
        <button onClick={() => setPicking('end')}
          style={{ flex:1, background:picking==='end'?T.selBg:T.cardBg2, border:`2px solid ${picking==='end'?T.sel:T.cardBorder}`, borderRadius:8, padding:'10px 14px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
          <div style={{ fontSize:8, color:T.textFaint, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:4 }}>🛬 Fin</div>
          <div style={{ fontSize:14, fontWeight:700, color:endDate ? T.text : T.textFaint, fontFamily:'monospace' }}>
            {endDate ? formatDisplay(endDate) : 'Choisir…'}
          </div>
          {endDate && <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{endTime}</div>}
        </button>
      </div>

      {/* Calendrier */}
      {picking && (
        <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, padding:14, boxShadow:'0 8px 32px #00000033' }}>
          {/* En-tête navigation */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button onClick={prevMonth} style={{ background:'none', border:`1px solid ${T.cardBorder}`, color:T.textMuted, cursor:'pointer', borderRadius:6, padding:'4px 10px', fontSize:14 }}>‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{MONTHS[view.month]} {view.year}</span>
            <button onClick={nextMonth} style={{ background:'none', border:`1px solid ${T.cardBorder}`, color:T.textMuted, cursor:'pointer', borderRadius:6, padding:'4px 10px', fontSize:14 }}>›</button>
          </div>

          {/* Jours de la semaine */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:6 }}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:9, color:T.textFaint, fontWeight:700, padding:'2px 0' }}>{d}</div>)}
          </div>

          {/* Cases jours */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {Array(firstDay).fill(null).map((_,i) => <div key={'b'+i} />)}
            {Array.from({ length: daysInMonth }, (_,i) => {
              const d   = i + 1
              const iso = isoDate(view.year, view.month, d)
              const isTod = iso === isoDate(today.getFullYear(), today.getMonth(), today.getDate())
              const isSt  = iso === startDate
              const isEnd = iso === endDate
              const inRng = isInRange(iso)
              const isHov = iso === hoverDate && picking === 'end'

              let bg = 'transparent', color = T.text, border = 'transparent'
              if (isSt || isEnd)  { bg = T.sel;    color = '#fff'; border = T.sel }
              else if (inRng)      { bg = T.selBg;  border = T.selBg }
              else if (isHov)      { bg = T.selBg }
              else if (isTod)      { bg = T.today;  border = T.cardBorder }

              return (
                <button key={d}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => picking === 'end' && setHoverDate(iso)}
                  onMouseLeave={() => setHoverDate(null)}
                  style={{ textAlign:'center', fontSize:11, padding:'6px 2px', borderRadius:5, cursor:'pointer', fontWeight:isSt||isEnd?700:400, background:bg, color, border:`1px solid ${border}` }}>
                  {d}
                </button>
              )
            })}
          </div>

          {/* Instruction */}
          <div style={{ marginTop:10, textAlign:'center', fontSize:10, color:T.textFaint }}>
            {picking === 'start' ? 'Cliquez pour choisir le début' : 'Cliquez pour choisir la fin'}
          </div>
        </div>
      )}

      {/* Heures */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Heure début</div>
          <input type="time" value={startTime} onChange={e => onChange({startDate, startTime:e.target.value, endDate, endTime})} style={inp} />
        </div>
        <div>
          <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Heure fin</div>
          <input type="time" value={endTime} onChange={e => onChange({startDate, startTime, endDate, endTime:e.target.value})} style={inp} />
        </div>
      </div>

      {/* Résumé durée */}
      {startDate && endDate && (
        <div style={{ background:T.cardBg2, borderRadius:7, padding:'8px 12px', border:`1px solid ${T.cardBorder}`, fontSize:11, color:T.textMuted, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Durée planifiée</span>
          <span style={{ fontWeight:700, color:T.text, fontFamily:'monospace' }}>
            {(() => {
              const s   = new Date(`${startDate}T${startTime||'00:00'}`)
              const e   = new Date(`${endDate}T${endTime||'00:00'}`)
              const min = Math.round((e.getTime() - s.getTime()) / 60000)
              if (min <= 0) return '—'
              return min >= 60 ? `${Math.floor(min/60)}h${min%60?String(min%60).padStart(2,'0'):''}` : `${min}min`
            })()}
          </span>
        </div>
      )}
    </div>
  )
}
