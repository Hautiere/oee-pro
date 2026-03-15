import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSitesTree, useUpdateMachine, useTimeline, useCreateEvent } from '../hooks/useReferentiel'
import { SiteOut, BuildingOut, WorkshopOut, MachineOut, MachineStatus } from '../api/referentiel'
import { STATUS_CONFIG, EVENT_CONFIG, oeeColor, pct, fmtDur, calcWeeklyOEE } from '../lib/oee'
import Timeline from '../components/Timeline'
import Donut from '../components/Donut'
import BarChartOEE from '../components/BarChartOEE'
import MaintPanel from '../components/MaintPanel'
import DateRangePicker from '../components/DateRangePicker'

// ── Thèmes ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    app:'#070b14', header:'#0a0e1a', sidebar:'#0a0e1a',
    card:'#0d1117', cardBorder:'#253148', cardBg2:'#0a0f1e',
    text:'#e2e8f0', textMuted:'#a0b0c8', textFaint:'#6b82a0',
    input:'#0d1117', inputBorder:'#2a3f5f',
    treeSel:'#1a3358', treeSelBorder:'#60a5fa', treeHover:'#111c2e',
    tabActive:'#93c5fd', tabBorder:'#60a5fa', secLabel:'#7090b0',
    headerBorder:'#1a2840',
  },
  light: {
    app:'#f0f4f8', header:'#ffffff', sidebar:'#ffffff',
    card:'#ffffff', cardBorder:'#c8d8e8', cardBg2:'#edf2f7',
    text:'#0f1923', textMuted:'#2d4060', textFaint:'#4a6080',
    input:'#ffffff', inputBorder:'#8090a8',
    treeSel:'#bfd4ef', treeSelBorder:'#1d4ed8', treeHover:'#dde8f5',
    tabActive:'#1d4ed8', tabBorder:'#2563eb', secLabel:'#3a5070',
    headerBorder:'#b8cce0',
  },
}

type ThemeKey = 'dark' | 'light'

// ── ThemeToggle ───────────────────────────────────────────────────────────────
function ThemeToggle({ theme, setTheme }: { theme: ThemeKey; setTheme: (t: ThemeKey) => void }) {
  const isDark = theme === 'dark'
  const T = THEMES[theme]
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      style={{
        width: 36, height: 36,
        borderRadius: '50%',
        border: `1px solid ${T.cardBorder}`,
        background: T.card,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
    >
      {/* Icône soleil / lune en SVG — pas d'emoji pour plus de contrôle */}
      {isDark ? (
        // Soleil
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1"  x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Lune
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

// ── Micro composants (dépendent du thème passé en prop) ───────────────────────
function SLabel({ children, T }: { children: React.ReactNode; T: typeof THEMES.dark }) {
  return <div style={{ fontSize:9, fontWeight:700, color:T.secLabel, letterSpacing:'0.18em', marginBottom:10, textTransform:'uppercase' }}>{children}</div>
}
function Card({ children, borderColor, T }: { children: React.ReactNode; borderColor?: string; T: typeof THEMES.dark }) {
  return <div style={{ background:T.card, border:`1px solid ${borderColor ?? T.cardBorder}`, borderRadius:10, padding:'16px 20px', transition:'background 0.2s, border-color 0.2s' }}>{children}</div>
}
function StatusDot({ status, size=8 }: { status:string; size?:number }) {
  const s = STATUS_CONFIG[status as MachineStatus] ?? STATUS_CONFIG.idle
  return <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:s.color, flexShrink:0, boxShadow:status==='running'?`0 0 5px ${s.color}88`:'none' }} title={s.label} />
}

type SelType = 'site'|'building'|'workshop'|'machine'
interface Sel { type:SelType; id:string }

// ── Panneau OEE ───────────────────────────────────────────────────────────────
function OEEPanel({ machine, T }: { machine: MachineOut; T: typeof THEMES.dark }) {
  const { data } = useTimeline(machine.id)
  const history = calcWeeklyOEE(data?.events ?? [])
  if (!history.length) return <Card T={T}><SLabel T={T}>OEE — Aucune donnée</SLabel><div style={{ color:T.textFaint, fontSize:11, textAlign:'center', padding:'20px 0' }}>Lancer le simulateur ou saisir des événements</div></Card>

  const last = history[history.length - 1]
  const lossA = 1 - last.A, lossP = last.A * (1 - last.P), lossQ = last.A * last.P * (1 - last.Q)
  const mainSlices = [
    { value: last.TRS, color: '#00e676', title: 'OEE net' },
    { value: lossQ,    color: '#ffd600', title: 'Qualité' },
    { value: lossP,    color: '#ff9100', title: 'Performance' },
    { value: lossA,    color: '#ff1744', title: 'Disponibilité' },
  ].filter(s => s.value > 0.001)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card T={T} borderColor={oeeColor(last.TRS) + '44'}>
        <SLabel T={T}>Analyse OEE — {history.length} semaines</SLabel>
        <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap', marginBottom:20 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <Donut slices={mainSlices} size={155} thickness={27} label={pct(last.TRS)} sublabel="OEE · semaine en cours" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px' }}>
              {[['#00e676','OEE net',pct(last.TRS)],['#ffd600','Qualité',pct(lossQ)],['#ff9100','Perf.',pct(lossP)],['#ff1744','Dispo.',pct(lossA)]].map(([c,l,v])=>(
                <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:T.textMuted }}>
                  <span style={{ width:9, height:9, borderRadius:2, background:c as string, flexShrink:0 }}/>
                  <span style={{ flex:1 }}>{l}</span>
                  <span style={{ fontWeight:700, color:c as string, fontFamily:'monospace' }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-start' }}>
            {[
              { k:'A', v:last.A, desc:'Disponibilité', c1:'#4299e1', c2:'#ff1744' },
              { k:'P', v:last.P, desc:'Performance',   c1:'#f6ad55', c2:'#ff9100' },
              { k:'Q', v:last.Q, desc:'Qualité',       c1:'#68d391', c2:'#ffd600' },
            ].map(({ k, v, desc, c1, c2 }) => (
              <div key={k} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, minWidth:92 }}>
                <Donut slices={[{value:v,color:c1,title:desc},{value:1-v,color:c2,title:'Perte'}]} size={92} thickness={15} label={pct(v)} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:c1 }}>{desc}</div>
                  <div style={{ fontSize:9, color:c2, fontWeight:600 }}>Perte: {pct(1-v)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7, flex:1, minWidth:155 }}>
            <SLabel T={T}>KPIs semaine en cours</SLabel>
            {[
              { desc:'OEE (A×P×Q)', val:pct(last.TRS), col:oeeColor(last.TRS), big:true },
              { desc:'Disponibilité (A)', val:pct(last.A), col:'#4299e1' },
              { desc:'Performance (P)',   val:pct(last.P), col:'#f6ad55' },
              { desc:'Qualité (Q)',       val:pct(last.Q), col:'#68d391' },
            ].map(k => (
              <div key={k.desc} style={{ background:T.cardBg2, borderRadius:8, padding:'8px 12px', border:`1.5px solid ${k.col}44`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <div style={{ fontSize:10, color:T.textMuted, fontWeight:600 }}>{k.desc}</div>
                <div style={{ fontSize:k.big?20:15, fontWeight:900, color:k.col, fontFamily:'monospace', flexShrink:0 }}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
        <SLabel T={T}>Historique OEE hebdomadaire</SLabel>
        <BarChartOEE history={history} />
      </Card>
    </div>
  )
}

// ── Panneau Timeline ──────────────────────────────────────────────────────────
function TimelinePanel({ machine, T }: { machine: MachineOut; T: typeof THEMES.dark }) {
  const { data, isLoading } = useTimeline(machine.id)
  if (isLoading) return <Card T={T}><div style={{ color:T.textFaint, fontSize:11 }}>Chargement…</div></Card>
  const events = data?.events ?? []
  const planned = data?.planned ?? []
  return (
    <Card T={T}>
      <SLabel T={T}>Timeline — 14 jours</SLabel>
      <Timeline events={events} planned={planned} days={14} />
      <div style={{ marginTop:16 }}>
        <SLabel T={T}>Résumé par type</SLabel>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10 }}>
          {Object.entries(EVENT_CONFIG).map(([k, v]) => {
            const evts = events.filter(e => e.event_type === k)
            const totMins = evts.reduce((s, e) => e.ended_at ? s + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000 : s, 0)
            return (
              <div key={k} style={{ background:T.cardBg2, borderRadius:8, padding:'12px 14px', border:`1px solid ${v.color}44` }}>
                <div style={{ fontSize:15, fontWeight:900, color:v.color, fontFamily:'monospace' }}>{Math.round(totMins/60)}h</div>
                <div style={{ fontSize:9, color:T.textMuted, marginTop:3, fontWeight:600 }}>{v.label}</div>
                <div style={{ fontSize:9, color:T.textFaint }}>{evts.length} événement{evts.length!==1?'s':''}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ── Panneau Saisie opérateur ──────────────────────────────────────────────────
function EventPanel({ machine, theme, T }: { machine: MachineOut; theme: 'dark'|'light'; T: typeof THEMES.dark }) {
  const { data, isLoading } = useTimeline(machine.id)
  const createEvent = useCreateEvent()
  const [form, setForm] = useState({
    event_type: 'running',
    startDate: '', startTime: '',
    endDate:   '', endTime:   '',
    quality_pct: 95, note: '',
  })
  const [msg, setMsg] = useState('')
  const inp = { background:T.input, color:T.text, border:`1px solid ${T.inputBorder}`, borderRadius:6, padding:'8px 10px', fontSize:12, width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit', outline:'none' }

  const EVENT_COLORS_MAP: Record<string,string> = {
    running:'#00e676', idle:'#ffd600', down:'#ff1744', maint:'#ff9100'
  }

  const submit = async () => {
    if (!form.startDate || !form.startTime) { setMsg('Date et heure de début requises'); return }
    const started_at = new Date(`${form.startDate}T${form.startTime}`).toISOString()
    const ended_at   = form.endDate && form.endTime
      ? new Date(`${form.endDate}T${form.endTime}`).toISOString()
      : undefined
    try {
      await createEvent.mutateAsync({
        machineId: machine.id,
        payload: {
          event_type:  form.event_type as any,
          started_at,
          ended_at,
          quality_pct: form.event_type === 'running' ? form.quality_pct : 100,
          note:        form.note || undefined,
        }
      })
      setMsg('✓ Événement enregistré')
      setForm({ event_type:'running', startDate:'', startTime:'', endDate:'', endTime:'', quality_pct:95, note:'' })
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('Erreur lors de la saisie') }
  }

  const events = data?.events ?? []

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card T={T}>
        <SLabel T={T}>Déclarer un événement</SLabel>

        {/* Type + Qualité */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Type d'événement</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {Object.entries(EVENT_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => setForm(p => ({...p, event_type:k}))}
                  style={{ padding:'8px 12px', borderRadius:7, cursor:'pointer', textAlign:'left' as const, border:`1.5px solid ${form.event_type===k?EVENT_COLORS_MAP[k]:EVENT_COLORS_MAP[k]+'44'}`, background:form.event_type===k?EVENT_COLORS_MAP[k]+'22':'transparent', color:form.event_type===k?EVENT_COLORS_MAP[k]:T.textMuted, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:EVENT_COLORS_MAP[k], flexShrink:0 }}/>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {form.event_type === 'running' && (
              <div>
                <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Qualité (%)</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="range" min={0} max={100} value={form.quality_pct} onChange={e => setForm(p => ({...p, quality_pct:+e.target.value}))} style={{ flex:1, accentColor:'#68d391' }} />
                  <span style={{ fontSize:16, fontWeight:700, color:'#68d391', fontFamily:'monospace', minWidth:40 }}>{form.quality_pct}%</span>
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Note / Cause</div>
              <textarea value={form.note} onChange={e => setForm(p => ({...p, note:e.target.value}))} placeholder="Cause, observation…" rows={3} style={{...inp, resize:'vertical' as const, lineHeight:1.6}} />
            </div>
          </div>
        </div>

        {/* Sélecteur de plage */}
        <div style={{ marginBottom:16 }}>
          <DateRangePicker
            startDate={form.startDate}
            startTime={form.startTime || ''}
            endDate={form.endDate}
            endTime={form.endTime || ''}
            theme={theme}
            onChange={({ startDate, startTime, endDate, endTime }) =>
              setForm(p => ({...p, startDate, startTime, endDate, endTime}))
            }
          />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={submit} disabled={createEvent.isPending || !form.startDate}
            style={{ padding:'10px 24px', background: form.startDate ? '#4299e1' : '#333', color: form.startDate ? '#fff' : T.textFaint, border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:700, transition:'background 0.15s' }}>
            {createEvent.isPending ? '…' : '💾 Enregistrer'}
          </button>
          {msg && <span style={{ fontSize:11, color: msg.startsWith('✓') ? '#00e676' : '#fc8181' }}>{msg}</span>}
        </div>
      </Card>
      <Card T={T}>
        <SLabel T={T}>Historique récent ({events.length} événements)</SLabel>
        {isLoading && <div style={{ color:T.textFaint, fontSize:11 }}>Chargement…</div>}
        {events.slice(-10).reverse().map(e => {
          const col = EVENT_CONFIG[e.event_type as keyof typeof EVENT_CONFIG]?.color ?? '#4a5568'
          const label = EVENT_CONFIG[e.event_type as keyof typeof EVENT_CONFIG]?.label ?? e.event_type
          const dur = e.ended_at ? Math.round((new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000) : null
          return (
            <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:6, borderRadius:8, border:`1px solid ${col}44`, background:T.cardBg2 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:col, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.text }}>{label}</div>
                <div style={{ fontSize:10, color:T.textMuted }}>
                  {e.started_at.slice(0,16).replace('T',' ')}
                  {e.ended_at && ` → ${e.ended_at.slice(0,16).replace('T',' ')}`}
                  {dur !== null && <span style={{ color:col, fontWeight:600, marginLeft:8 }}>{fmtDur(dur)}</span>}
                  {e.event_type === 'running' && <span style={{ color:'#68d391', fontWeight:700, marginLeft:8 }}>Q:{e.quality_pct}%</span>}
                </div>
                {e.note && <div style={{ fontSize:9, color:T.textFaint, marginTop:2 }}>{e.note}</div>}
              </div>
            </div>
          )
        })}
        {events.length === 0 && !isLoading && <div style={{ textAlign:'center', padding:'20px 0', color:T.textFaint, fontSize:11 }}>Aucun événement</div>}
      </Card>
    </div>
  )
}

// ── Arbre sidebar ─────────────────────────────────────────────────────────────
function TreeRow({ label, icon, level, isSelected, isExpanded, hasChildren, badge, onClick, onToggle, children, T }: any) {
  return (
    <div>
      <div onClick={onClick}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = T.treeHover }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        style={{ display:'flex', alignItems:'center', padding:`6px 10px 6px ${10+level*16}px`, cursor:'pointer', userSelect:'none', background:isSelected?T.treeSel:'transparent', borderLeft:`2px solid ${isSelected?T.treeSelBorder:'transparent'}`, transition:'background 0.15s' }}>
        {hasChildren
          ? <span onClick={e=>{e.stopPropagation();onToggle()}} style={{ fontSize:10, color:T.textMuted, marginRight:4, width:12, textAlign:'center', flexShrink:0, display:'inline-block', transition:'transform .15s', transform:isExpanded?'rotate(90deg)':'none' }}>▶</span>
          : <span style={{ width:16, flexShrink:0 }} />}
        <span style={{ fontSize:12, marginRight:6, flexShrink:0 }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:isSelected?700:500, color:isSelected?T.text:T.textMuted, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        {badge && <span style={{ fontSize:10, color:badge.color, fontWeight:700, marginLeft:4, flexShrink:0 }}>{badge.text}</span>}
      </div>
      {isExpanded && children}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AssetsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { data: sites = [], isLoading } = useSitesTree()
  const updateMachine = useUpdateMachine()

  const [theme, setTheme] = useState<ThemeKey>('dark')
  const [exp, setExp] = useState<Record<string, boolean>>({})
  const [sel, setSel] = useState<Sel | null>(null)
  const [machTab, setMachTab] = useState<'oee'|'timeline'|'maint'|'events'|'config'>('oee')
  const [navMod, setNavMod] = useState<'assets'|'oee'>('assets')

  const T = THEMES[theme]
  const toggle = (id: string) => setExp(p => ({...p, [id]: !p[id]}))
  const allMachines = sites.flatMap(s => s.buildings.flatMap(b => b.workshops.flatMap(w => w.machines)))

  const findNode = (id: string, type: SelType) => {
    for (const s of sites) {
      if (type==='site' && s.id===id) return s
      for (const b of s.buildings) {
        if (type==='building' && b.id===id) return b
        for (const w of b.workshops) {
          if (type==='workshop' && w.id===id) return w
          for (const m of w.machines) if (type==='machine' && m.id===id) return m
        }
      }
    }
    return null
  }

  const countM = (node: any) => {
    let ms: MachineOut[] = []
    if ('buildings' in node) node.buildings.forEach((b:any) => b.workshops.forEach((w:any) => ms.push(...w.machines)))
    else if ('workshops' in node) node.workshops.forEach((w:any) => ms.push(...w.machines))
    else if ('machines' in node) ms = node.machines
    return { total:ms.length, running:ms.filter((m:any)=>m.status==='running').length, down:ms.filter((m:any)=>m.status==='down'||m.status==='maint').length }
  }

  const selNode = sel ? findNode(sel.id, sel.type) : null
  const inp = { background:T.input, color:T.text, border:`1px solid ${T.inputBorder}`, borderRadius:6, padding:'8px 10px', fontSize:12, width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit', outline:'none' }

  const renderMachineDetail = (m: MachineOut) => {
    const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.idle
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:900 }}>
        <Card T={T} borderColor={st.color+'44'}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}>
            <div style={{ width:46, height:46, borderRadius:10, background:st.color+'18', border:`1.5px solid ${st.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🔩</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.text, marginBottom:6 }}>{m.name}</div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:9, fontWeight:700, color:st.color, background:st.color+'18', border:`1px solid ${st.color}44`, borderRadius:4, padding:'2px 8px' }}>● {st.label}</span>
                <span style={{ fontSize:9, color:T.textFaint }}>{m.machine_type} · {m.machine_function}</span>
                {m.serial_number && <span style={{ fontSize:9, color:T.textFaint, fontFamily:'monospace' }}>SN: {m.serial_number}</span>}
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display:'flex', overflowX:'auto', borderBottom:`1px solid ${T.cardBorder}` }}>
          {[{id:'oee',label:'📊 OEE'},{id:'timeline',label:'📅 Timeline'},{id:'maint',label:'🗓️ Maintenance'},{id:'events',label:'✏️ Saisie'},{id:'config',label:'⚙️ Config'}].map(tb => (
            <button key={tb.id} onClick={() => setMachTab(tb.id as any)}
              style={{ padding:'8px 16px', background:'none', color:machTab===tb.id?T.tabActive:T.textMuted, border:'none', borderBottom:`2px solid ${machTab===tb.id?T.tabBorder:'transparent'}`, cursor:'pointer', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
              {tb.label}
            </button>
          ))}
        </div>

        {machTab === 'oee'      && <OEEPanel      machine={m} T={T} />}
        {machTab === 'timeline' && <TimelinePanel machine={m} T={T} />}
        {machTab === 'maint'    && <MaintPanel machine={m} theme={theme} T={T} />}
        {machTab === 'events'   && <EventPanel    machine={m} theme={theme} T={T} />}
        {machTab === 'config'   && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Card T={T}>
              <SLabel T={T}>Statut opérationnel</SLabel>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {(Object.entries(STATUS_CONFIG) as [MachineStatus, {label:string;color:string}][]).map(([id, s]) => (
                  <button key={id} onClick={() => updateMachine.mutate({ id:m.id, payload:{ status:id } })}
                    style={{ padding:'7px 14px', borderRadius:7, cursor:'pointer', border:`1.5px solid ${m.status===id?s.color:s.color+'33'}`, background:m.status===id?s.color+'22':'transparent', color:m.status===id?s.color:T.textMuted, fontSize:10, fontWeight:700 }}>
                    ● {s.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card T={T}>
              <SLabel T={T}>Identité machine</SLabel>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
                {[['Type', m.machine_type], ['Fonction', m.machine_function], ['Fabricant', m.manufacturer??'—'], ['N° Série', m.serial_number??'—'], ['Année', m.year_installed?.toString()??'—'], ['Cadence ref.', `${m.cadence_ref} pcs/h`]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:13, color:T.text, fontFamily:'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>
            {m.tags.length > 0 && (
              <Card T={T}>
                <SLabel T={T}>Tags</SLabel>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {m.tags.map(tag => <span key={tag} style={{ background:T.cardBg2, border:`1px solid ${T.cardBorder}`, color:'#63b3ed', fontSize:9, borderRadius:4, padding:'2px 8px', fontWeight:700 }}>{tag}</span>)}
                </div>
              </Card>
            )}
            {m.notes && <Card T={T}><SLabel T={T}>Notes</SLabel><div style={{ fontSize:12, color:T.textMuted, lineHeight:1.7 }}>{m.notes}</div></Card>}
            <div style={{ fontSize:9, color:T.textFaint, textAlign:'right' }}>ID: {m.id}</div>
          </div>
        )}
      </div>
    )
  }

  const renderNodeDetail = (node: any) => {
    const icons: Record<string, string> = { site:'🌐', building:'🏢', workshop:'⚙️' }
    const cnts = countM(node)
    const children = sel!.type==='site' ? node.buildings : sel!.type==='building' ? node.workshops : node.machines
    const childType = sel!.type==='site' ? 'building' : sel!.type==='building' ? 'workshop' : 'machine'
    const childLabel = { site:'Bâtiment', building:'Atelier', workshop:'Machine' }[sel!.type] ?? ''
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:760 }}>
        <Card T={T}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}>
            <div style={{ width:46, height:46, borderRadius:10, background:T.cardBg2, border:`1px solid ${T.cardBorder}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{icons[sel!.type]}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.text, marginBottom:8 }}>{node.name}</div>
              {'address' in node && node.address && <div style={{ fontSize:11, color:T.textMuted, marginBottom:6 }}>📍 {node.address}</div>}
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[{v:cnts.total,l:'Machines',c:T.textMuted},{v:cnts.running,l:'En marche',c:'#00e676'},{v:cnts.down,l:'Anomalies',c:cnts.down>0?'#ff9100':T.textFaint}].map(k => (
                  <div key={k.l}><span style={{ fontSize:16, fontWeight:900, color:k.c, fontFamily:'monospace' }}>{k.v}</span><br/><span style={{ fontSize:9, color:T.textFaint }}>{k.l}</span></div>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card T={T}>
          <SLabel T={T}>{childLabel}s</SLabel>
          {children.length === 0
            ? <div style={{ textAlign:'center', padding:'20px 0', color:T.textFaint, fontSize:11 }}>Aucun {childLabel.toLowerCase()}</div>
            : children.map((child: any) => {
              const isMachine = childType === 'machine'
              const st = isMachine ? (STATUS_CONFIG[child.status as MachineStatus] ?? STATUS_CONFIG.idle) : null
              const cc = isMachine ? null : countM(child)
              return (
                <div key={child.id}
                  onClick={() => { setSel({ type:childType as SelType, id:child.id }); if (isMachine) setMachTab('oee') }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.treeHover}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.cardBg2}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:8, cursor:'pointer', marginBottom:6, background:T.cardBg2, border:`1px solid ${T.cardBorder}`, transition:'background 0.15s' }}>
                  {isMachine ? <StatusDot status={child.status} size={11} /> : <span style={{ fontSize:15 }}>{icons[childType] ?? '⚙️'}</span>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{child.name}</div>
                    {isMachine && <div style={{ fontSize:9, color:T.textFaint, marginTop:2 }}>{child.machine_type} · {child.machine_function}</div>}
                    {!isMachine && cc && <div style={{ fontSize:9, color:T.textFaint, marginTop:2 }}>{cc.total} machine{cc.total!==1?'s':''}</div>}
                  </div>
                  {isMachine && st && <span style={{ fontSize:9, fontWeight:700, color:st.color, background:st.color+'18', border:`1px solid ${st.color}44`, borderRadius:4, padding:'2px 6px' }}>{st.label}</span>}
                  <span style={{ color:T.textFaint, fontSize:14 }}>›</span>
                </div>
              )
            })}
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:T.app, color:T.text, fontFamily:"'JetBrains Mono','Courier New',monospace", overflow:'hidden', transition:'background 0.2s, color 0.2s' }}>

      {/* Header */}
      <div style={{ background:T.header, borderBottom:`1px solid ${T.headerBorder}`, padding:'0 16px', height:50, display:'flex', alignItems:'center', gap:12, flexShrink:0, transition:'background 0.2s' }}>
        <div style={{ background:'linear-gradient(135deg,#667eea,#4299e1)', borderRadius:7, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>🏭</div>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, lineHeight:1.2 }}>OEE Pro</div>
          <div style={{ fontSize:7, color:T.textFaint, letterSpacing:'0.12em' }}>PRODUCTION INTELLIGENCE</div>
        </div>

        <nav style={{ display:'flex', gap:2, marginLeft:16, flex:1 }}>
          {[{id:'assets',icon:'🏭',label:'Asset Manager'},{id:'oee',icon:'📊',label:'OEE / TRS'}].map(mod => (
            <button key={mod.id} onClick={() => setNavMod(mod.id as any)}
              style={{ padding:'6px 12px', background:navMod===mod.id?T.cardBg2:'none', color:navMod===mod.id?T.tabActive:T.textMuted, border:'none', borderBottom:`2px solid ${navMod===mod.id?T.tabBorder:'transparent'}`, cursor:'pointer', fontSize:10, fontWeight:navMod===mod.id?700:500, display:'flex', alignItems:'center', gap:5 }}>
              <span>{mod.icon}</span><span>{mod.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'auto', flexShrink:0 }}>
          {Object.entries(STATUS_CONFIG).map(([id, s]) => {
            const count = allMachines.filter(m => m.status === id).length
            if (!count) return null
            return <span key={id} style={{ fontSize:8, fontWeight:700, color:s.color, background:s.color+'18', border:`1px solid ${s.color}44`, borderRadius:4, padding:'2px 6px' }}>{count} {s.label}</span>
          })}
          {user && <span style={{ fontSize:11, color:T.textMuted }}>{user.full_name}</span>}

          {/* Toggle thème */}
          <ThemeToggle theme={theme} setTheme={setTheme} />

          <button onClick={() => { logout(); navigate('/login') }}
            style={{ background:'none', border:`1px solid ${T.inputBorder}`, borderRadius:5, color:T.textFaint, padding:'4px 10px', fontSize:11, cursor:'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Sidebar */}
        {navMod === 'assets' && (
          <div style={{ width:280, background:T.sidebar, borderRight:`1px solid ${T.headerBorder}`, display:'flex', flexDirection:'column', flexShrink:0, transition:'background 0.2s' }}>
            <div style={{ padding:'10px 14px 8px', borderBottom:`1px solid ${T.headerBorder}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:9, fontWeight:700, color:T.secLabel, letterSpacing:'0.18em', textTransform:'uppercase' }}>Asset Tree</span>
              <span style={{ fontSize:10, color:T.textMuted, fontWeight:600 }}>{allMachines.length} machines</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
              {isLoading && <div style={{ padding:20, color:T.textFaint, fontSize:11, textAlign:'center' }}>Chargement…</div>}
              {sites.map(site => {
                const sc = countM(site)
                return (
                  <TreeRow key={site.id} label={site.name} icon="🌐" level={0} isSelected={sel?.id===site.id} isExpanded={!!exp[site.id]} hasChildren={site.buildings.length>0}
                    badge={sc.down>0?{text:`⚠ ${sc.down}`,color:'#ff9100'}:sc.running>0?{text:`${sc.running}▶`,color:'#00e676'}:null}
                    onClick={() => setSel({type:'site',id:site.id})} onToggle={() => toggle(site.id)} T={T}>
                    {site.buildings.map(b => {
                      const bc = countM(b)
                      return (
                        <TreeRow key={b.id} label={b.name} icon="🏢" level={1} isSelected={sel?.id===b.id} isExpanded={!!exp[b.id]} hasChildren={b.workshops.length>0}
                          badge={bc.down>0?{text:`⚠ ${bc.down}`,color:'#ff9100'}:null}
                          onClick={() => setSel({type:'building',id:b.id})} onToggle={() => toggle(b.id)} T={T}>
                          {b.workshops.map(w => {
                            const wc = countM(w)
                            return (
                              <TreeRow key={w.id} label={w.name} icon="⚙️" level={2} isSelected={sel?.id===w.id} isExpanded={!!exp[w.id]} hasChildren={w.machines.length>0}
                                badge={wc.down>0?{text:'⚠',color:'#ff1744'}:null}
                                onClick={() => setSel({type:'workshop',id:w.id})} onToggle={() => toggle(w.id)} T={T}>
                                {w.machines.map(m => (
                                  <TreeRow key={m.id} label={m.name} icon={<StatusDot status={m.status} />} level={3} isSelected={sel?.id===m.id} isExpanded={false} hasChildren={false}
                                    onClick={() => { setSel({type:'machine',id:m.id}); setMachTab('oee') }} onToggle={() => {}} T={T}>
                                    {null}
                                  </TreeRow>
                                ))}
                              </TreeRow>
                            )
                          })}
                        </TreeRow>
                      )
                    })}
                  </TreeRow>
                )
              })}
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', background:T.app, minWidth:0 }}>
          {navMod === 'oee' && (
            <div style={{ maxWidth:900 }}>
              <SLabel T={T}>Vue OEE — toutes les machines</SLabel>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
                {allMachines.map(m => {
                  const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.idle
                  return (
                    <div key={m.id}
                      onClick={() => { setSel({type:'machine',id:m.id}); setNavMod('assets'); setMachTab('oee') }}
                      style={{ background:T.card, borderRadius:10, padding:'12px 14px', border:`1px solid ${T.cardBorder}`, cursor:'pointer', transition:'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = st.color}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = T.cardBorder}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <StatusDot status={m.status} size={9} />
                        <div style={{ fontSize:10, fontWeight:700, color:T.text, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                      </div>
                      <div style={{ fontSize:9, color:st.color, fontWeight:700 }}>{st.label}</div>
                      <div style={{ fontSize:9, color:T.textFaint, marginTop:4 }}>{m.machine_type}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {navMod === 'assets' && (
            <>
              {!sel && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:14, opacity:0.4 }}>
                  <div style={{ fontSize:52 }}>🏭</div>
                  <div style={{ fontSize:13, color:T.textMuted }}>Sélectionner un nœud dans l'arbre</div>
                  <div style={{ fontSize:10, color:T.textFaint }}>{sites.length} sites · {allMachines.length} machines</div>
                </div>
              )}
              {sel && selNode && (sel.type === 'machine' ? renderMachineDetail(selNode as MachineOut) : renderNodeDetail(selNode))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
