import { useMemo } from 'react'
import type { ContractSpec } from '../data/types'
import { ContractPicker } from '../components/ContractPicker'
import { calculate, formatMoney, formatNumber, formatTreasury, parseMove, type MoveUnit } from '../lib/calc'
import { STORAGE_KEYS, useLocalStorage } from '../lib/storage'

interface CalcState {
  symbol: string
  qty: string
  move: string
  unit: MoveUnit
}

interface Props {
  contracts: ContractSpec[]
  symbol: string
  onSymbolChange: (s: string) => void
}

export const DEFAULT_CALC: CalcState = { symbol: 'MNQ', qty: '1', move: '10', unit: 'points' }

export function Calculator({ contracts, symbol, onSymbolChange }: Props) {
  const [st, setSt] = useLocalStorage<Omit<CalcState, 'symbol'>>(STORAGE_KEYS.calculator, {
    qty: DEFAULT_CALC.qty, move: DEFAULT_CALC.move, unit: DEFAULT_CALC.unit,
  })
  const spec = contracts.find((c) => c.symbol === symbol) ?? contracts[0]
  const is32 = spec.priceFormat === '32nds'

  const qty = Number(st.qty)
  const move = parseMove(st.move, spec, st.unit)
  const qtyOk = st.qty.trim() !== '' && Number.isFinite(qty) && qty >= 0
  const moveOk = Number.isFinite(move)

  const r = useMemo(
    () => (qtyOk && moveOk ? calculate(spec, qty, move, st.unit) : null),
    [spec, qty, move, st.unit, qtyOk, moveOk],
  )
  const cur = spec.currency

  const setUnit = (unit: MoveUnit) => {
    if (unit === st.unit) return
    // Convert the typed move so the value doesn't jump when toggling.
    let next = st.move
    if (moveOk) {
      const conv = calculate(spec, 1, move, st.unit)
      next = unit === 'ticks' ? formatNumber(conv.ticks, 6).replace(/,/g, '') : is32 ? formatTreasury(conv.points) : formatNumber(conv.points, 9).replace(/,/g, '')
    }
    setSt({ ...st, unit, move: next })
  }

  const step = (d: number) => {
    const n = Math.max(0, Math.round((qtyOk ? qty : 0) + d))
    setSt({ ...st, qty: String(n) })
  }

  return (
    <section className="screen calc">
      <div className="calc-grid">
        <div className="panel inputs">
          <label className="field-label">Contract</label>
          <ContractPicker contracts={contracts} value={spec} onChange={(c) => onSymbolChange(c.symbol)} />

          <div className="row2">
            <div>
              <label className="field-label" htmlFor="qty">Contracts</label>
              <div className="stepper">
                <button type="button" onClick={() => step(-1)} aria-label="Fewer contracts">−</button>
                <input id="qty" inputMode="numeric" value={st.qty}
                  onChange={(e) => setSt({ ...st, qty: e.target.value })} className={qtyOk ? '' : 'bad'} />
                <button type="button" onClick={() => step(1)} aria-label="More contracts">+</button>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="move">Move size</label>
              <div className="move-wrap">
                <input id="move" inputMode="decimal" value={st.move}
                  placeholder={st.unit === 'points' ? (is32 ? 'e.g. 1-16 or 1.5' : 'e.g. 10') : 'e.g. 40'}
                  onChange={(e) => setSt({ ...st, move: e.target.value })} className={moveOk || st.move === '' ? '' : 'bad'} />
              </div>
            </div>
          </div>

          <div className="seg" role="radiogroup" aria-label="Move unit">
            {(['points', 'ticks'] as MoveUnit[]).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={st.unit === u}
                className={st.unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
                {u === 'points' ? 'Points' : 'Ticks'}
              </button>
            ))}
          </div>
          {is32 && st.unit === 'points' && (
            <p className="hint">Treasury: 1 point = 1 full handle. You can type 32nds as <code>1-16</code> (= 1 16/32) or <code>0-08.5</code>.</p>
          )}
        </div>

        <div className="panel result">
          <div className="result-label">
            {qtyOk ? formatNumber(qty) : '—'} {spec.symbol} × {moveOk ? (st.unit === 'points' && is32 ? `${formatTreasury(move)} (${formatNumber(move)} pts)` : `${formatNumber(move)} ${st.unit === 'points' ? (Math.abs(move) === 1 ? 'pt' : 'pts') : (Math.abs(move) === 1 ? 'tick' : 'ticks')}`) : '—'}
          </div>
          <div className={`big-value ${r && r.value < 0 ? 'neg' : ''}`} data-testid="value">
            {r ? formatMoney(r.value, cur) : '—'}
          </div>
          {cur !== 'USD' && <div className="cur-note">Value in {cur} (contract currency)</div>}

          <ul className="lines">
            <li>
              <span>Equivalent</span>
              <b>{r ? (st.unit === 'points'
                ? `${formatNumber(r.ticks, 4)} ticks${is32 ? ` · ${formatNumber(r.points * 32, 4)}/32` : ''}`
                : `${formatNumber(r.points, 9)} pts${is32 ? ` (${formatTreasury(r.points)})` : ''}`) : '—'}</b>
            </li>
            <li>
              <span>Per tick, 1 contract</span>
              <b>{formatMoney(spec.tickValue, cur)} <em>({spec.tickLabel ?? formatNumber(spec.tickSize, 9)})</em></b>
            </li>
            <li>
              <span>Per point, 1 contract</span>
              <b>{formatMoney(spec.pointValue, cur)}</b>
            </li>
          </ul>
          {r?.fractionalTicks && <p className="warn">Note: that move isn’t a whole number of ticks (tick = {formatNumber(spec.tickSize, 9)}).</p>}
          <p className="quote-note">{spec.quoteNotes}</p>
        </div>
      </div>
    </section>
  )
}
