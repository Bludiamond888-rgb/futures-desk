import { useMemo, useState } from 'react'
import type { PropPoint } from '../lib/prop'
import { formatMoney } from '../lib/calc'

interface Props {
  series: PropPoint[]
  startDate: string
  startingBalance: number
  initialThreshold: number
  target: number | null
  height?: number
}

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

/** Balance vs drawdown threshold, one point per session close. */
export function PropChart({ series, startDate, startingBalance, initialThreshold, target, height = 190 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const H = height
  const pad = { l: 4, r: 8, t: 12, b: 24 }
  const GUTTER = 62 // px, y-axis labels live outside the SVG so they never overlap the lines
  const data = useMemo(() => [{ date: startDate, balance: startingBalance, threshold: initialThreshold, pnl: 0 }, ...series], [series, startDate, startingBalance, initialThreshold])
  const tgt = target != null ? startingBalance + target : null
  const vals = data.flatMap((p) => [p.balance, p.threshold])
  const hi = Math.max(...vals, tgt != null && tgt - Math.max(...vals) < (Math.max(...vals) - Math.min(...vals)) * 0.6 ? tgt : -Infinity)
  const ticks = niceTicks(Math.min(...vals), hi)
  const yMin = ticks[0], yMax = ticks[ticks.length - 1]
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b)
  const path = (k: 'balance' | 'threshold') => data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('')
  const stepPath = data.map((p, i) => (i ? `L${x(i).toFixed(1)},${y(data[i - 1].threshold).toFixed(1)}L${x(i).toFixed(1)},${y(p.threshold).toFixed(1)}` : `M${x(0).toFixed(1)},${y(p.threshold).toFixed(1)}`)).join('')
  const fill = `${path('balance')}L${x(data.length - 1).toFixed(1)},${y(data[data.length - 1].threshold).toFixed(1)}${data.slice().reverse().map((p, j) => `L${x(data.length - 1 - j).toFixed(1)},${y(p.threshold).toFixed(1)}`).join('')}Z`
  const fmt = (v: number) => formatMoney(v, 'USD', 0).replace(/\.00$/, '')
  const showTgt = tgt != null && tgt <= yMax && tgt >= yMin

  return (
    <div className="equity prop-chart" style={{ height: H, paddingLeft: GUTTER }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Balance and drawdown threshold"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, i)))
        }}>
        {ticks.map((t) => <line key={t} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" vectorEffect="non-scaling-stroke" />)}
        <line x1={pad.l} x2={W - pad.r} y1={y(startingBalance)} y2={y(startingBalance)} className="zero" vectorEffect="non-scaling-stroke" />
        {showTgt && <line x1={pad.l} x2={W - pad.r} y1={y(tgt!)} y2={y(tgt!)} className="tgt" vectorEffect="non-scaling-stroke" />}
        <path d={fill} fill="rgba(16,185,129,.08)" />
        <path d={stepPath} fill="none" stroke="#fb7185" strokeWidth="1.8" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <path d={path('balance')} fill="none" stroke="#34d399" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="eq-labels">
        {ticks.map((t) => <span key={t} className="eq-y" style={{ top: `${(y(t) / H) * 100}%` }}>{fmt(t)}</span>)}
        {showTgt && <span className="pc-tag tgt" style={{ top: `${(y(tgt!) / H) * 100}%` }}>Target</span>}
        <span className="eq-x left" style={{ left: GUTTER }}>{data[0].date}</span>
        <span className="eq-x right">{data[data.length - 1].date}</span>
        {hover != null && data[hover] && (
          <span className="eq-tip" style={{ left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${Math.min(0.8, Math.max(0.2, x(hover) / W))})` }}>
            <b>{formatMoney(data[hover].balance, 'USD', 0)}</b>
            <em>{data[hover].date} · limit {formatMoney(data[hover].threshold, 'USD', 0)}</em>
          </span>
        )}
      </div>
    </div>
  )
}
