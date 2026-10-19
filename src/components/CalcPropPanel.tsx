import { useMemo } from 'react'
import type { ContractSpec, Trade } from '../data/types'
import { calculate, formatMoney, parseMove, type MoveUnit } from '../lib/calc'
import { computeProp, isMicro, maxContractsFor, riskCheck, type PropAccount } from '../lib/prop'
import { STORAGE_KEYS, useLocalStorage } from '../lib/storage'

interface Props {
  accounts: PropAccount[]
  trades: Trade[]
  spec: ContractSpec
  qty: number | null
  unit: MoveUnit
}

interface PanelState { open: boolean; accountId: string; stop: string }

const $ = (n: number) => formatMoney(n, 'USD', 2)
/** "leaves $Y before X" — or, when the stop goes past it, "goes $Y past X". */
const left = (n: number, what: string, verb = '') => n > 0
  ? <>{verb && `${verb} `}<b>{$(n)}</b> before {what}</>
  : n === 0
    ? <>{verb && `${verb} `}<b className="neg">$0.00</b> before {what} (touching it counts as a breach)</>
    : <>{verb ? 'goes ' : ''}<b className="neg">{$(-n)}</b> past {what}</>

/** Optional prop-account risk check under the calculator. Hidden unless prop accounts exist. */
export function CalcPropPanel({ accounts, trades, spec, qty, unit }: Props) {
  const [st, setSt] = useLocalStorage<PanelState>(STORAGE_KEYS.calcProp, { open: false, accountId: '', stop: '' })
  const acct = accounts.find((a) => a.id === st.accountId) ?? null
  const summary = useMemo(() => (acct ? computeProp(acct, trades) : null), [acct, trades])

  if (!accounts.length && !acct) return null

  const stopMove = st.stop.trim() ? parseMove(st.stop, spec, unit) : NaN
  const stopOk = Number.isFinite(stopMove) && stopMove > 0
  const perContract = stopOk ? Math.abs(calculate(spec, 1, stopMove, unit).value) : null
  const usd = spec.currency === 'USD'
  const maxC = acct ? maxContractsFor(acct.rules, spec) : null
  const check = acct && summary && perContract != null && qty != null && usd
    ? riskCheck({ riskPerContract: perContract, qty, ddRoom: Math.max(0, summary.distanceToDD), dllRoom: summary.dllRoom, maxContracts: maxC })
    : null
  const overMaxOnly = acct && qty != null && maxC != null && qty > maxC
  const kind = isMicro(spec) ? 'micros' : 'minis'

  return (
    <div className={`panel prop-panel ${st.open ? 'open' : ''}`} data-testid="calc-prop">
      <button type="button" className="pp-toggle" aria-expanded={st.open} onClick={() => setSt({ ...st, open: !st.open })}>
        <span>Prop account check</span>
        <em>{acct ? acct.name : 'optional'}</em>
        <i aria-hidden>{st.open ? '▾' : '▸'}</i>
      </button>
      {st.open && (
        <div className="pp-body">
          <div className="row2">
            <div>
              <label className="field-label" htmlFor="pp-acct">Prop account</label>
              <select id="pp-acct" value={st.accountId} onChange={(e) => setSt({ ...st, accountId: e.target.value })}>
                <option value="">None</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="pp-stop">Stop size ({unit})</label>
              <input id="pp-stop" inputMode="decimal" value={st.stop} placeholder={unit === 'points' ? 'e.g. 15' : 'e.g. 60'}
                onChange={(e) => setSt({ ...st, stop: e.target.value })} className={st.stop && !stopOk ? 'bad' : ''} />
            </div>
          </div>

          {acct && summary && (
            <p className="hint tight">Room now: {$(Math.max(0, summary.distanceToDD))} to the drawdown limit ({$(summary.threshold)})
              {summary.dllRoom != null ? <>, {$(summary.dllRoom)} of today’s daily loss limit</> : <>, no daily loss limit</>}.
              {maxC != null && <> Max {maxC} {kind}.</>}
            </p>
          )}
          {acct && !usd && <p className="warn">Prop accounts are tracked in USD; {spec.symbol} is quoted in {spec.currency}, so no prop check.</p>}

          {check && (
            <div className={`pp-result ${check.breachDD || check.breachDLL ? 'bad' : ''}`} data-testid="prop-risk">
              <p>
                This risks <b>{$(check.risk)}</b>, which {left(check.leftDD, 'your drawdown limit', 'leaves')}
                {check.leftDLL != null
                  ? <> and {left(check.leftDLL, 'today’s daily loss limit')}.</>
                  : <> (this account has no daily loss limit).</>}
              </p>
              {(check.breachDD || check.breachDLL) && (
                <p className="pp-warn" role="alert">⚠ A full stop-out would breach {check.breachDD && check.breachDLL ? 'both your drawdown limit and today’s daily loss limit' : check.breachDD ? 'your drawdown limit' : 'today’s daily loss limit'}.</p>
              )}
              <p className="pp-max">At this stop the remaining room allows <b data-testid="max-by-room">{check.maxByRoom ?? '—'}</b> contract{check.maxByRoom === 1 ? '' : 's'}{maxC != null ? ` (account max ${maxC} ${kind})` : ''}.</p>
            </div>
          )}
          {overMaxOnly && <p className="pp-warn" role="alert" data-testid="over-max">⚠ {qty} {spec.symbol} exceeds this account’s max of {maxC} {kind}.</p>}
          {acct && !st.stop && <p className="hint tight">Enter a stop size to see how much of your remaining room this trade uses. Risk excludes commissions.</p>}
        </div>
      )}
    </div>
  )
}
