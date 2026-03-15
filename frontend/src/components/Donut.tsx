interface Slice { value: number; color: string; title: string }

interface Props {
  slices: Slice[]
  size?: number
  thickness?: number
  label: string
  sublabel?: string
}

export default function Donut({ slices, size = 140, thickness = 22, label, sublabel }: Props) {
  const cx = size / 2, cy = size / 2
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  const arcs = slices.map((sl, i) => {
    const len = Math.max(0, sl.value) * circ
    const gap = circ * 0.015
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none"
        stroke={sl.color} strokeWidth={thickness}
        strokeDasharray={`${Math.max(0, len - gap)} ${circ}`}
        strokeDashoffset={-(offset - circ * 0.25)}>
        <title>{sl.title}: {Math.round(sl.value * 100)}%</title>
      </circle>
    )
    offset += len
    return el
  })

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#253148" strokeWidth={thickness} />
        {arcs}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: size > 120 ? 18 : 12, fontWeight: 900, color: '#e2e8f0', fontFamily: 'monospace', lineHeight: 1 }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 7, color: '#a0b0c8', marginTop: 3, textAlign: 'center', padding: '0 6px' }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  )
}
