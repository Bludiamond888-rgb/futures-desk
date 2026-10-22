import { useMemo } from 'react'
import type { ContractSpec, Trade } from '../data/types'
import { CalcPropPanel } from '../components/CalcPropPanel'
import type { PropAccount } from '../lib/prop'
import { ContractPicker } from '../components/ContractPicker'
import { calculate, calculateTpSl, formatMoney, formatNumber, formatTreasury, parseMove, parseTreasury, type MoveUnit, type Side } from '../lib/calc'
import { STORAGE_KEYS, useLocalStorage } from '../lib/storage'

interface CalcState {
  symbol: string
  qty: string
  move: string
  unit: MoveUnit
}

interface TpSlState {
  qty: string
  tp: string
  sl: string
  unit: MoveUnit
  entry: string
  side: Side
}

interface Props {
  contracts: ContractSpec[]
  symbol: string
  onSymbolChange: (s: string) => void
  accounts?: PropAccount[]
  trades?: Trade[]
}

export const DEFAULT_CALC: CalcState = { symbol: 'MNQ', qty: '1', move: '10', unit: 'points' }

export function Calculator({ contracts, symbol, onSymbolChange, accounts = [], trades = [] }: Props) {
  const [raw, setRaw] = useLocalStorage<Partial<TpSlState> & { move?: string }>(STORAGE_KEYS.calculator, {
    qty: DEFAULT_CALC.qty, tp: '', sl: '', unit: DEFAULT_CALC.unit, entry: '', side: 'long',
  })
  // Migrate the old single "move" value into Take profit.
  const st: TpSlState = {
    qty: raw.qty ?? DEFAULT_CALC.qty, tp: raw.tp ?? raw.move ?? '', sl: raw.sl ?? '',
    unit: raw.unit ?? DEFAULT_CALC.unit, entry: raw.entry ?? '', side: raw.side ?? 'long',
  }
  const setSt = (n: TpSlState) => setRaw(n)
  const spec = contracts.find((c) => c.symbol === symbol) ?? contracts[0]
  const is32 = spec.priceFormat === '32nds'
  const cur = spec.currency

  const qty = Number(st.qty)
  const qtyOk = st.qty.trim() !== '' && Number.isFinite(qty) && qty >= 0
  const tp = parseMove(st.tp, spec, st.unit)
  const sl = parseMove(st.sl, spec, st.unit)
  const tpOk = Number.isFinite(tp)
  const slOk = Number.isFinite(sl)
  const entryStr = st.entry.trim().replace(/,/g, '')
  const entry = entryStr === '' ? NaN : is32 ? parseTreasury(entryStr) : Number(entryStr)
  const entryOk = Number.isFinite(entry)

  const r = useMemo(
    () => calculateTpSl(spec, qtyOk ? qty : 0, tpOk ? tp : null, slOk ? sl : null, st.unit, entryOk ? entry : null, st.side),
    [spec, qty, qtyOk, tp, tpOk, sl, slOk, st.unit, entry, entryOk, st.side],
  )
  const show = qtyOk

  const conv = (v: string, ok: boolean, n: number, unit: MoveUnit) => {
    if (!ok) return v
    const c = calculate(spec, 1, n, st.unit)
    return unit === 'ticks' ? formatNumber(c.ticks, 6).replace(/,/g, '') : is32 ? formatTreasury(c.points) : formatNumber(c.points, 9).replace(/,/g, '')
  }
  const setUnit = (unit: MoveUnit) => {
    if (unit === st.unit) return
    setSt({ ...st, unit, tp: conv(st.tp, tpOk, tp, unit), sl: conv(st.sl, slOk, sl, unit) })
  }
  const step = (d: number) => {
    const n = Math.max(0, Math.round((qtyOk ? qty : 0) + d))
    setSt({ ...st, qty: String(n) })
  }
  const tickDp = (String(spec.tickSize).split('.')[1] ?? '').length
  const fmtPrice = (p: number) => is32 ? formatTreasury(p) : p.toLocaleString('en-US', { minimumFractionDigits: Math.min(tickDp, 6), maximumFractionDigits: Math.min(tickDp, 6) })
  const ticksTxt = (t: number) => `${formatNumber(t, 4)} ${t === 1 ? 'tick' : 'ticks'}`
  const ph = st.unit === 'points' ? (is32 ? 'e.g. 1-16' : 'e.g. 10') : 'e.g. 40'

  return (
    <section className="screen calc">
      <div className="calc-grid">
        <div className="panel inputs">
          <label className="field-label">Contract</label>
          <ContractPicker contracts={contracts} value={spec} onChange={(c) => onSymbolChange(c.symbol)} />

          <label className="field-label" htmlFor="qty">Contracts</label>
          <div className="stepper">
            <button type="button" onClick={() => step(-1)} aria-label="Fewer contracts">−</button>
            <input id="qty" inputMode="numeric" value={st.qty}
              onChange={(e) => setSt({ ...st, qty: e.target.value })} className={qtyOk ? '' : 'bad'} />
            <button type="button" onClick={() => step(1)} aria-label="More contracts">+</button>
          </div>

          <div className="row2 tpsl-inputs">
            <div>
              <label className="field-label tp" htmlFor="tp">Take profit</label>
              <input id="tp" className={`tp ${tpOk || st.tp.trim() === '' ? '' : 'bad'}`} inputMode="decimal" value={st.tp}
                placeholder={ph} onChange={(e) => setSt({ ...st, tp: e.target.value })} />
            </div>
            <div>
              <label className="field-label sl" htmlFor="sl">Stop loss</label>
              <input id="sl" className={`sl ${slOk || st.sl.trim() === '' ? '' : 'bad'}`} inputMode="decimal" value={st.sl}
                placeholder={ph} onChange={(e) => setSt({ ...st, sl: e.target.value })} />
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

          <div className="row2 entry-row">
            <div>
              <label className="field-label" htmlFor="entry">Entry price <em className="opt">(optional)</em></label>
              <input id="entry" inputMode="decimal" value={st.entry} placeholder={is32 ? 'e.g. 110-16' : 'e.g. 5000'}
                className={entryOk || entryStr === '' ? '' : 'bad'} onChange={(e) => setSt({ ...st, entry: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Direction</label>
              <div className="seg side" role="radiogroup" aria-label="Direction">
                {(['long', 'short'] as Side[]).map((sd) => (
                  <button key={sd} type="button" role="radio" aria-checked={st.side === sd}
                    className={st.side === sd ? `on ${sd}` : ''} onClick={() => setSt({ ...st, side: sd })}>
                    {sd === 'long' ? 'Long' : 'Short'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <CalcPropPanel accounts={accounts} trades={trades} spec={spec} qty={qtyOk ? qty : null} unit={st.unit} />
        </div>

        <div className="panel result">
          <div className="result-label">{qtyOk ? formatNumber(qty) : '—'} × {spec.symbol}{entryOk ? ` · ${st.side === 'long' ? 'Long' : 'Short'} @ ${fmtPrice(entry)}` : ''}</div>
          <div className="tpsl">
            <div className="tpsl-box tp">
              <span>Take profit</span>
              <b data-testid="tp-value">{show && r.tp ? '+' + formatMoney(r.tp.value, cur) : '—'}</b>
              <em>{show && r.tp ? ticksTxt(r.tp.ticks) : 'enter a target'}</em>
              {r.tpPrice != null && <i data-testid="tp-price">@ {fmtPrice(r.tpPrice)}</i>}
            </div>
            <div className="tpsl-box sl">
              <span>Stop loss</span>
              <b data-testid="sl-value">{show && r.sl ? '−' + formatMoney(r.sl.value, cur) : '—'}</b>
              <em>{show && r.sl ? ticksTxt(r.sl.ticks) : 'enter a stop'}</em>
              {r.slPrice != null && <i data-testid="sl-price">@ {fmtPrice(r.slPrice)}</i>}
            </div>
          </div>
          {cur !== 'USD' && <div className="cur-note">Values in {cur} (contract currency)</div>}

          <ul className="lines">
            <li><span>Reward : risk</span><b data-testid="rr">{r.rr != null ? `${r.rr.toFixed(2)} : 1` : '—'}</b></li>
            <li><span>Breakeven win rate</span><b data-testid="bewr">{r.breakevenWinRate != null ? `${(r.breakevenWinRate * 100).toFixed(1)}%` : '—'}</b></li>
            <li>
              <span>Per tick, 1 contract</span>
              <b>{formatMoney(spec.tickValue, cur)} <em>({spec.tickLabel ?? formatNumber(spec.tickSize, 9)})</em></b>
            </li>
            <li><span>Per point, 1 contract</span><b>{formatMoney(spec.pointValue, cur)}</b></li>
          </ul>
          {(r.tp?.fractionalTicks || r.sl?.fractionalTicks) && <p className="warn">Note: a distance isn’t a whole number of ticks (tick = {formatNumber(spec.tickSize, 9)}).</p>}
          <p className="quote-note">{spec.quoteNotes}</p>
        </div>
      </div>
    </section>
  )
}
