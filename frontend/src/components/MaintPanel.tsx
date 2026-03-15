import { useState } from 'react'
import { useTimeline, useCreatePlanned } from '../hooks/useReferentiel'
import { MachineOut } from '../api/referentiel'
import { fmtDur } from '../lib/oee'
import DateRangePicker from './DateRangePicker'

type Theme = 'dark' | 'light'

const MAINT_LABELS: Record<string,string> = {
  maint: 'Maintenance préventive',
  down:  'Arrêt correctif',
  idle:  'Arrêt production',
}
const MAINT_COLORS: Record<string,string> = {
  maint: '#ff9100', down: '#ff1744', idle: '#ffd600',
}

export default function MaintPanel({ machine, theme, T }: { machine: MachineOut; theme: Theme; T: any }) {
  const { data, isLoading } = useTimeline(machine.id)
  const createPlanned = useCreatePlanned()

  const [form, setForm] = useState({
    startDate: '', startTime: '08:00',
    endDate:   '', endTime:   '12:00',
    maint_type: 'maint',
    reason: '',
  })
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)

  const inp = {
    background: T.input, color: T.text, border: `1px solid ${T.inputBorder}`,
    borderRadius: 6, padding: '8px 10px', fontSize: 12,
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  const submit = async () => {
    if (!form.startDate || !form.endDate) { setMsg('Choisir les dates début et fin'); return }
    const planned_date = new Date(`${form.startDate}T${form.startTime}`).toISOString()
    const endDt        = new Date(`${form.endDate}T${form.endTime}`)
    const startDt      = new Date(`${form.startDate}T${form.startTime}`)
    const duration_min = Math.round((endDt.getTime() - startDt.getTime()) / 60000)
    if (duration_min <= 0) { setMsg('La fin doit être après le début'); return }

    try {
      await createPlanned.mutateAsync({
        machineId: machine.id,
        payload: { planned_date, duration_min, maint_type: form.maint_type as any, reason: form.reason || undefined },
      })
      setMsg('✓ Maintenance planifiée')
      setForm({ startDate:'', startTime:'08:00', endDate:'', endTime:'12:00', maint_type:'maint', reason:'' })
      setShowForm(false)
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('Erreur lors de la planification') }
  }

  const planned = data?.planned ?? []
  const upcoming = planned.filter(p => !p.is_done && new Date(p.planned_date) >= new Date()).sort((a,b) => a.planned_date.localeCompare(b.planned_date))
  const past     = planned.filter(p => p.is_done  || new Date(p.planned_date) <  new Date()).sort((a,b) => b.planned_date.localeCompare(a.planned_date))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, padding:'16px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:showForm?16:0 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T.secLabel, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:showForm?0:0 }}>
            🗓️ Planifier une maintenance ({planned.length})
          </div>
          <button onClick={() => setShowForm(s => !s)}
            style={{ padding:'5px 14px', background:showForm?T.cardBg2:'#1a2d4a', color:showForm?T.textMuted:'#63b3ed', border:`1px solid ${showForm?T.cardBorder:'#4299e144'}`, borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700 }}>
            {showForm ? 'Annuler' : '+ Planifier'}
          </button>
        </div>

        {showForm && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Type */}
            <div>
              <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Type d'arrêt</div>
              <div style={{ display:'flex', gap:8 }}>
                {Object.entries(MAINT_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setForm(p => ({...p, maint_type:k}))}
                    style={{ flex:1, padding:'8px 10px', borderRadius:7, cursor:'pointer', border:`1.5px solid ${form.maint_type===k?MAINT_COLORS[k]:MAINT_COLORS[k]+'44'}`, background:form.maint_type===k?MAINT_COLORS[k]+'22':'transparent', color:form.maint_type===k?MAINT_COLORS[k]:T.textMuted, fontSize:10, fontWeight:700, textAlign:'center' as const }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur plage de dates */}
            <DateRangePicker
              startDate={form.startDate}
              startTime={form.startTime}
              endDate={form.endDate}
              endTime={form.endTime}
              theme={theme}
              onChange={({ startDate, startTime, endDate, endTime }) =>
                setForm(p => ({...p, startDate, startTime, endDate, endTime}))
              }
            />

            {/* Motif */}
            <div>
              <div style={{ fontSize:9, color:T.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Motif (optionnel)</div>
              <input value={form.reason} onChange={e => setForm(p => ({...p, reason:e.target.value}))} placeholder="ex: Révision annuelle, remplacement courroie…" style={inp} />
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={submit} disabled={createPlanned.isPending || !form.startDate || !form.endDate}
                style={{ padding:'10px 24px', background: form.startDate&&form.endDate ? '#ff9100' : '#333', color: form.startDate&&form.endDate ? '#000' : T.textFaint, border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:900, transition:'background 0.15s' }}>
                {createPlanned.isPending ? '…' : '✅ Confirmer'}
              </button>
              {msg && <span style={{ fontSize:11, color: msg.startsWith('✓') ? '#00e676' : '#fc8181' }}>{msg}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, padding:'16px 20px' }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#ff9100', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:12 }}>À venir</div>
          {upcoming.map(pm => {
            const col = MAINT_COLORS[pm.maint_type] ?? '#ff9100'
            const dur = pm.duration_min
            return (
              <div key={pm.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:T.cardBg2, borderRadius:8, marginBottom:6, border:`1px solid ${col}44` }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:col, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.text }}>{pm.reason || MAINT_LABELS[pm.maint_type]}</div>
                  <div style={{ fontSize:10, color:T.textMuted, marginTop:2 }}>
                    {new Date(pm.planned_date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    <span style={{ color:col, fontWeight:600, marginLeft:8 }}>{fmtDur(dur)}</span>
                  </div>
                </div>
                <span style={{ fontSize:9, color:col, background:col+'18', border:`1px solid ${col}44`, borderRadius:4, padding:'2px 6px', fontWeight:700 }}>{MAINT_LABELS[pm.maint_type]}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, padding:'16px 20px', opacity:0.7 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T.textFaint, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:12 }}>Passé</div>
          {past.slice(0,5).map(pm => {
            const col = MAINT_COLORS[pm.maint_type] ?? '#ff9100'
            return (
              <div key={pm.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', background:T.cardBg2, borderRadius:8, marginBottom:4, border:`1px solid ${T.cardBorder}` }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:col, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:T.textMuted }}>{pm.reason || MAINT_LABELS[pm.maint_type]}</div>
                  <div style={{ fontSize:9, color:T.textFaint }}>
                    {new Date(pm.planned_date).toLocaleDateString('fr-FR')} · {fmtDur(pm.duration_min)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {planned.length === 0 && !isLoading && !showForm && (
        <div style={{ textAlign:'center', padding:'30px 0', color:T.textFaint, fontSize:11 }}>
          Aucune maintenance planifiée — cliquez sur "+ Planifier" pour en ajouter
        </div>
      )}
    </div>
  )
}
