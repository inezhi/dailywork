import type { ReactNode } from 'react'

export function FocusRing({
  size = 64,
  value,
  stroke = 5,
  label,
  sublabel,
  tone = 'accent',
  showHalo = false,
}: {
  size?: number
  value: number
  stroke?: number
  label?: ReactNode
  sublabel?: string
  tone?: 'accent' | 'success'
  showHalo?: boolean
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="focus-ring" style={{ width: size, height: size }}>
      {showHalo && <span className="halo" />}
      <svg width={size} height={size} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'success' ? 'var(--success)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="focus-ring-label">
          {label != null && <b style={{ fontSize: Math.max(11, Math.round(size * 0.2)) }}>{label}</b>}
          {sublabel && <span>{sublabel}</span>}
        </div>
      )}
    </div>
  )
}
