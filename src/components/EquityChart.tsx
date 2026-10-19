import { useMemo, useState } from 'react'
import type { Currency } from '../data/types'
import type { EquityPoint } from '../lib/stats'
import { formatMoney } from '../lib/calc'

interface Props { points: EquityPoint[]; currency: Currency; height?: number }

const W = 800

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(Math.round(v / step) * step)
  return out
}

/** Dependency-free SVG equity curve (cumulative net P&L per trade). */
export function EquityChart({ points, currency, height = 240 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const H = height
  const pad = { l: 64, r: 16, t: 14, b: 26 }
  const data = useMemo(() => [{ id: 'start', datetime: points[0]?.datetime ?? '', net: 0, cum: 0 }, ...points], [points])
  const ys = data.map((p) => p.cum)
  const ticks = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys))
  const yMin = ticks[0], yMax = ticks[ticks.length - 1]
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b)
  const line = data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join('')
  const area = `${line}L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`
  const last = data[data.length - 1]?.cum ?? 0
  const up = last >= 0
  const gid = `eq-${currency}`
  const fmtAxis = (v: number) => formatMoney(v, currency, 0).replace(/\.00$/, '')

  return (
    <div className="equity">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Equity curve ${currency}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))
          setHover(Math.max(1, Math.min(data.length - 1, i)))
        }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? '#10b981' : '#f43f5e'} stopOpacity=".35" />
            <stop offset="100%" stopColor={up ? '#10b981' : '#f43f5e'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'zero' : 'grid'} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="cursor" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* HTML overlay labels so text isn't stretched by preserveAspectRatio="none" */}
      <div className="eq-labels">
        {ticks.map((t) => (
          <span key={t} className="eq-y" style={{ top: `${(y(t) / H) * 100}%` }}>{fmtAxis(t)}</span>
        ))}
        <span className="eq-x left">{points[0]?.datetime.slice(0, 10)}</span>
        <span className="eq-x right">{points[points.length - 1]?.datetime.slice(0, 10)}</span>
        {hover != null && data[hover] && (
          <span className="eq-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <b>{formatMoney(data[hover].cum, currency, 2)}</b>
            <em>{data[hover].datetime.replace('T', ' ')} · {data[hover].net >= 0 ? '+' : ''}{formatMoney(data[hover].net, currency, 2)}</em>
          </span>
        )}
      </div>
    </div>
  )
}
