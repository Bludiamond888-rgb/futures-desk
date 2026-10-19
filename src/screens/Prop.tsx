import { useMemo, useState } from 'react'
import type { Trade } from '../data/types'
import { DRAWDOWN_LABEL, FIRM_BY_ID, sizeLabel } from '../data/propFirms'
import { computeProp, type PropAccount, type PropSummary } from '../lib/prop'
import { formatMoney } from '../lib/calc'
import { AccountForm } from '../components/AccountForm'
import { PropChart } from '../components/PropChart'
import { ConfirmDialog } from '../components/Modal'
import { IconEdit, IconTrash } from '../components/Icons'

interface Props {
  accounts: PropAccount[]
  upsertAccount: (a: PropAccount) => void
  removeAccount: (id: string) => void
  trades: Trade[]
  setTrades: (t: Trade[] | ((p: Trade[]) => Trade[])) => void
  onViewTrades: (accountId: string) => void
  onLoadSample: () => void
}

const $ = (n: number, frac = 0) => formatMoney(n, 'USD', frac)
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${$(Math.abs(n))}`
const HEALTH_LABEL = { ok: 'On track', warning: 'Warning', breached: 'Breached', target: 'Target reached' } as const

function Gauge({ label, value, max, sub, testid }: { label: string; value: number | null; max: number | null; sub: React.ReactNode; testid: string }) {
  const has = value != null && max != null && max > 0
  const ratio = has ? Math.max(0, Math.min(1, value! / max!)) : 0
  const cls = !has ? 'g-off' : ratio <= 0 ? 'g-bad' : ratio <= 0.25 ? 'g-warn' : ''
  return (
    <div className={`gauge ${cls}`} data-testid={testid}>
      <div className="g-head"><span>{label}</span><b>{has ? $(value!) : '—'}</b></div>
      <div className="g-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max ?? 0} aria-valuenow={has ? value! : 0}><div style={{ width: `${ratio * 100}%` }} /></div>
      <div className="g-sub">{sub}</div>
    </div>
  )
}

function AccountCard({ a, s, onEdit, onDelete, onViewTrades }: { a: PropAccount; s: PropSummary; onEdit: () => void; onDelete: () => void; onViewTrades: () => void }) {
  const r = a.rules
  const firm = a.firmId === 'custom' ? 'Custom rules' : FIRM_BY_ID[a.firmId]?.name ?? a.firmId
  const pct = s.targetProgress != null ? Math.min(1, s.targetProgress) : 0
  const cons = s.consistencyPct
  const consScale = Math.max(100, cons ?? 0)
  return (
    <article className={`panel pcard h-${s.health}`} data-testid={`prop-card-${a.id}`}>
      <header className="pc-head">
        <div className="pc-title">
          <h3>{a.name}{a.sample && <span className="badge sample">Sample</span>}</h3>
          <p className="muted">{firm}{a.firmId !== 'custom' ? ` · ${a.program}` : ''} · {sizeLabel(a.size)} · {a.phase === 'evaluation' ? 'Evaluation' : 'Funded'}</p>
        </div>
        <div className="pc-badges">
          <span className={`hbadge ${s.health}`} data-testid="health">{HEALTH_LABEL[s.health]}</span>
          {a.status !== 'active' && <span className={`badge status-${a.status}`}>{a.status === 'passed' ? 'Passed' : 'Blown'}</span>}
          <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit account" title="Edit"><IconEdit /></button>
          <button type="button" className="icon-btn danger" onClick={onDelete} aria-label="Delete account" title="Delete"><IconTrash /></button>
        </div>
      </header>

      <div className="pc-top">
        <div className="pc-bal">
          <span>Balance</span>
          <b data-testid="balance">{$(s.balance, 2)}</b>
          <em className={s.profit > 0 ? 'pos' : s.profit < 0 ? 'neg' : ''}>{signed(s.profit)} since {a.startDate}</em>
        </div>
        <div className="pc-target">
          {r.profitTarget != null ? <>
            <div className="g-head"><span>Profit target</span><b data-testid="target-pct">{Math.round((s.targetProgress ?? 0) * 100)}%</b></div>
            <div className="tbar"><div style={{ width: `${pct * 100}%` }} /></div>
            <div className="g-sub">{$(Math.max(0, s.profit))} of {$(r.profitTarget)}{s.targetRemaining ? ` · ${$(s.targetRemaining)} to go` : ''}</div>
          </> : <div className="g-sub">No profit target in this phase.</div>}
        </div>
      </div>

      <div className="pc-gauges">
        <Gauge testid="dd-room" label="Drawdown room" value={Math.max(0, s.distanceToDD)} max={r.maxDrawdown}
          sub={<>Limit {$(s.threshold)}{s.locked ? ' · locked' : ''} · {DRAWDOWN_LABEL[r.drawdownType]}</>} />
        <Gauge testid="dll-room" label="Daily loss room" value={s.dllRoom} max={r.dailyLossLimit}
          sub={r.dailyLossLimit != null ? <>Today {signed(s.todayPnl)} of {$(r.dailyLossLimit)} limit</> : <>No daily loss limit · today {signed(s.todayPnl)}</>} />
        <div className={`gauge cons ${r.consistencyPct != null && s.consistencyOk === false ? 'g-warn' : ''}`} data-testid="consistency">
          <div className="g-head"><span>Consistency</span><b>{cons != null ? `${cons.toFixed(0)}%` : '—'}</b></div>
          <div className="g-bar">
            <div style={{ width: `${Math.min(100, ((cons ?? 0) / consScale) * 100)}%` }} />
            {r.consistencyPct != null && <i className="mark" style={{ left: `${(r.consistencyPct / consScale) * 100}%` }} />}
          </div>
          <div className="g-sub">
            {r.consistencyPct != null
              ? <>Best day {$(s.largestDay)} · rule ≤ {r.consistencyPct}%{s.consistencyOk === false && s.consistencyNeeded ? ` · need ${$(s.consistencyNeeded)} total` : ''}</>
              : <>No consistency rule{s.largestDay > 0 ? ` · best day ${$(s.largestDay)}` : ''}</>}
          </div>
        </div>
        <div className="gauge days">
          <div className="g-head"><span>Trading days</span><b data-testid="days">{s.tradingDays}{r.minTradingDays != null ? ` / ${r.minTradingDays}` : ''}</b></div>
          <div className="g-bar"><div style={{ width: `${r.minTradingDays ? Math.min(100, (s.tradingDays / r.minTradingDays) * 100) : s.tradingDays ? 100 : 0}%` }} /></div>
          <div className="g-sub">{r.minTradingDays != null ? `Minimum ${r.minTradingDays}` : 'No minimum'} · {s.tradeCount} trades</div>
        </div>
      </div>

      {s.reasons.length > 0 && <ul className="pc-reasons">{s.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}

      <div className="pc-chart">
        <div className="pc-legend"><span className="lg bal">Balance</span><span className="lg thr">Drawdown limit</span></div>
        <PropChart series={s.series} startDate={a.startDate} startingBalance={a.startingBalance} initialThreshold={s.initialThreshold} target={r.profitTarget} />
      </div>

      <footer className="pc-foot">
        <p className="src-note small">
          <b>Rules change often — confirm with your firm.</b>{' '}
          {a.verification === 'custom' || !a.sourceUrl
            ? 'Custom rules entered by you.'
            : <>Preset {a.verification === 'verified' ? 'checked' : 'partly checked'} {a.lastVerified} against <a href={a.sourceUrl} target="_blank" rel="noreferrer">the firm’s page</a>{a.edited ? '; you edited some values' : ''}.</>}
          {a.unverified && <> <span className="warn-inline">Not confirmed: {a.unverified}</span></>}
          {r.drawdownType === 'intraday' && <> Intraday trailing is approximated from each trade’s closed result (no tick data), so open-profit peaks aren’t captured; your firm’s live threshold may be higher.</>}
          {r.drawdownType === 'eod' && <> End-of-day trailing uses each session’s closing balance (sessions roll at 6 PM ET).</>}
          {s.skipped > 0 && <> {s.skipped} linked non-USD trade{s.skipped > 1 ? 's are' : ' is'} excluded.</>}
        </p>
        {r.notes && <p className="hint small">{r.notes}</p>}
        <button type="button" className="btn ghost sm" onClick={onViewTrades}>View {s.tradeCount} linked trades</button>
      </footer>
    </article>
  )
}

export function Prop({ accounts, upsertAccount, removeAccount, trades, setTrades, onViewTrades, onLoadSample }: Props) {
  const [form, setForm] = useState<{ acct: PropAccount | null } | null>(null)
  const [del, setDel] = useState<PropAccount | null>(null)
  const [now] = useState(() => new Date())
  const summaries = useMemo(() => new Map(accounts.map((a) => [a.id, computeProp(a, trades, now)])), [accounts, trades, now])
  const order = { active: 0, passed: 1, blown: 2 }
  const sorted = [...accounts].sort((a, b) => order[a.status] - order[b.status] || a.createdAt.localeCompare(b.createdAt))

  return (
    <section className="screen prop">
      <div className="j-head">
        <div>
          <h2 className="screen-title">Prop accounts</h2>
          <p className="hint tight">Rules tracker for evaluation and funded accounts. Link trades from the journal to see room left.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setForm({ acct: null })}>+ New account</button>
      </div>

      {accounts.some((a) => a.sample) && (
        <p className="sample-note" role="note">Showing SAMPLE prop accounts and trades for demonstration. Remove them in Journal → Data → Remove sample data.</p>
      )}

      {accounts.length === 0 ? (
        <div className="panel placeholder">
          <h2>No prop accounts yet</h2>
          <p>Create one from a firm preset (Apex, Topstep, Take Profit Trader, MyFundedFutures, Tradeify, Bulenox, Elite Trader Funding, TradeDay, Lucid) or enter custom rules.</p>
          <p className="hint">Then link trades to it from the trade form or the Trades list. Want to look around first? <button type="button" className="linkish" onClick={onLoadSample}>Load sample data</button> (clearly labelled SAMPLE).</p>
        </div>
      ) : (
        <div className="pcards">
          {sorted.map((a) => (
            <AccountCard key={a.id} a={a} s={summaries.get(a.id)!}
              onEdit={() => setForm({ acct: a })} onDelete={() => setDel(a)} onViewTrades={() => onViewTrades(a.id)} />
          ))}
        </div>
      )}

      {form && <AccountForm initial={form.acct} onClose={() => setForm(null)} onSave={(a) => { upsertAccount(a); setForm(null) }} />}
      {del && (
        <ConfirmDialog title="Delete prop account?" danger confirmLabel="Delete account"
          message={<>Delete <b>{del.name}</b>? Its {trades.filter((t) => t.accountId === del.id).length} linked trades stay in your journal and are simply unlinked.</>}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            const id = del.id
            removeAccount(id)
            setTrades((p) => p.map((t) => (t.accountId === id ? (({ accountId: _x, ...rest }) => { void _x; return { ...rest, updatedAt: new Date().toISOString() } })(t) : t)))
            setDel(null)
          }} />
      )}
    </section>
  )
}
