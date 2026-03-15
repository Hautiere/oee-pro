import { useState } from 'react'
import { oeeColor, pct } from '../lib/oee'

interface WeekData { date: string; A: number; P: number; Q: number; TRS: number }
interface Props { history: WeekData[] }

export default function BarChartOEE({ history }: Props) {
  const [hov, setHov] = useState<number | null>(null)
  if (!history?.length) return null

  const W = Math.max(560, history.length * 52), H = 120, PAD_L = 32
  const bw = Math.max(10, (W - PAD_L) / history.length - 5)

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Légende */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        {[{ c: '#00e676', l: 'Excellent ≥85%' }, { c: '#ff9100', l: 'Acceptable ≥65%' }, { c: '#ff1744', l: 'Insuffisant <65%' }].map(k => (
          <span key={k.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#a0b0c8', fontWeight: 600 }}>
            <span style={{ width: 14, height: 3, background: k.c, display: 'inline-block', borderRadius: 2 }} />
            {k.l}
          </span>
        ))}
      </div>
      <svg width={W} height={H + 50} style={{ overflow: 'visible', display: 'block', fontFamily: 'monospace' }}>
        {/* Lignes de référence */}
        {[0, 25, 50, 65, 75, 85, 100].map(v => {
          const y = H - v / 100 * H, imp = v === 65 || v === 85
          return (
            <g key={v}>
              <line x1={PAD_L} y1={y} x2={W} y2={y} stroke={imp ? '#6b82a0' : '#253148'} strokeWidth={imp ? 1.5 : 0.5} strokeDasharray={imp ? '5,3' : '2,4'} />
              <text x={PAD_L - 4} y={y + 4} fill={imp ? '#a0b0c8' : '#6b82a0'} fontSize={imp ? 9 : 7} textAnchor="end" fontWeight={imp ? 700 : 400}>{v}%</text>
            </g>
          )
        })}
        {/* Barres */}
        {history.map((h, i) => {
          const x = PAD_L + i * (bw + 5)
          const bh = Math.max(4, h.TRS * H)
          const col = oeeColor(h.TRS)
          const isHov = hov === i
          return (
            <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <rect x={x} y={H - bh} width={bw} height={bh} fill={col} opacity={isHov ? 1 : 0.78} rx={3} />
              <text x={x + bw / 2} y={H - bh - 5} fill={col} fontSize={isHov ? 11 : 9} textAnchor="middle" fontWeight={700}>{pct(h.TRS)}</text>
              <text x={x + bw / 2} y={H + 14} fill="#a0b0c8" fontSize={8} textAnchor="middle" fontWeight={isHov ? 700 : 400}>{h.date.slice(5)}</text>
              {isHov && (() => {
                const px = Math.min(x, W - 158)
                return (
                  <g>
                    <rect x={px} y={H - bh - 72} width={154} height={62} fill="#0d1117" rx={5} stroke={col} strokeWidth={1.5} />
                    <text x={px + 7} y={H - bh - 56} fill="#e2e8f0" fontSize={9} fontWeight={700}>{h.date}</text>
                    <text x={px + 7} y={H - bh - 40} fill={col} fontSize={13} fontWeight={900}>OEE {pct(h.TRS)}</text>
                    <text x={px + 7}   y={H - bh - 24} fill="#4299e1" fontSize={9}>A:{pct(h.A)}</text>
                    <text x={px + 56}  y={H - bh - 24} fill="#f6ad55" fontSize={9}>P:{pct(h.P)}</text>
                    <text x={px + 105} y={H - bh - 24} fill="#68d391" fontSize={9}>Q:{pct(h.Q)}</text>
                    <text x={px + 7}   y={H - bh - 10} fill="#6b82a0" fontSize={7}>= {pct(h.A)}×{pct(h.P)}×{pct(h.Q)}</text>
                  </g>
                )
              })()}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
