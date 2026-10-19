import { useMemo, useRef, useState } from 'react'
import type { ContractSpec, Side, Trade } from '../data/types'
import { ContractPicker } from './ContractPicker'
import { Modal } from './Modal'
import { IconDown, IconEdit, IconTrash, IconUp } from './Icons'
import { formatMoney, formatNumber, parseMove } from '../lib/calc'
import { computeTrade, newId, nowLocal, priceInput, snapshotSpec } from '../lib/journal'
import { compressImage } from '../lib/image'
import { formatBytesish, getStorageHealth, STORAGE_LIMIT_CHARS, STORAGE_WARN_RATIO } from '../lib/storage'
import type { PropAccount } from '../lib/prop'

export type FormMode = 'new' | 'edit' | 'duplicate'

interface Props {
  mode: FormMode
  initial: Trade | null
  contracts: ContractSpec[]
  strategies: string[]
  defaultSymbol: string
  onSave: (t: Trade) => void
  onClose: () => void
  onManageStrategies: () => void
  accounts?: PropAccount[]
  defaultAccount?: string
}

export function TradeForm({ mode, initial, contracts, strategies, defaultSymbol, onSave, onClose, onManageStrategies, accounts = [], defaultAccount = '' }: Props) {
  const startSpec = contracts.find((c) => c.symbol === (initial?.symbol ?? defaultSymbol)) ?? contracts[0]
  const [symbol, setSymbol] = useState(startSpec.symbol)
  const [f, setF] = useState(() => ({
    datetime: mode === 'duplicate' || !initial ? nowLocal() : initial.datetime,
    side: (initial?.side ?? 'long') as Side,
    qty: initial ? String(initial.qty) : '1',
    entry: priceInput(initial?.entry, initial ?? startSpec),
    exit: priceInput(initial?.exit, initial ?? startSpec),
    stop: priceInput(initial?.stop, initial ?? startSpec),
    fees: initial ? String(initial.fees) : '0',
    strategy: initial?.strategy ?? strategies[0] ?? '',
    notes: initial?.notes ?? '',
    accountId: initial ? initial.accountId ?? '' : defaultAccount,
  }))
  const [shot, setShot] = useState<string | undefined>(initial?.screenshot)
  const [shotMsg, setShotMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [touched, setTouched] = useState(false)

  // Edit keeps the trade's own spec snapshot unless the contract is changed.
  const liveSpec = contracts.find((c) => c.symbol === symbol)
  const spec = useMemo(() => (initial && mode === 'edit' && symbol === initial.symbol
    ? { tickSize: initial.tickSize, tickValue: initial.tickValue, currency: initial.currency, priceFormat: initial.priceFormat }
    : liveSpec ? snapshotSpec(liveSpec) : null), [initial, mode, symbol, liveSpec])

  const p = (s: string) => (spec ? parseMove(s, spec, 'points') : NaN)
  const qty = Number(f.qty), entry = p(f.entry), exit = p(f.exit)
  const stop = f.stop.trim() ? p(f.stop) : null
  const fees = f.fees.trim() === '' ? 0 : Number(f.fees.replace(/,/g, ''))
  const errors: Record<string, string> = {}
  if (!spec) errors.symbol = 'Pick a contract'
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(f.datetime)) errors.datetime = 'Date & time required'
  if (!(qty > 0) || !Number.isInteger(qty)) errors.qty = 'Whole number ≥ 1'
  if (!Number.isFinite(entry)) errors.entry = 'Required'
  if (!Number.isFinite(exit)) errors.exit = 'Required'
  if (stop != null && !Number.isFinite(stop)) errors.stop = 'Invalid'
  if (!Number.isFinite(fees) || fees < 0) errors.fees = '≥ 0'
  const ok = Object.keys(errors).length === 0

  const calc = useMemo(
    () => (spec && Number.isFinite(entry) && Number.isFinite(exit) && qty > 0
      ? computeTrade({ side: f.side, entry, exit, qty, fees: Number.isFinite(fees) ? fees : 0, stop: stop != null && Number.isFinite(stop) ? stop : null, tickSize: spec.tickSize, tickValue: spec.tickValue })
      : null),
    [spec, entry, exit, qty, fees, stop, f.side],
  )
  const cur = spec?.currency ?? 'USD'
  const is32 = spec?.priceFormat === '32nds'
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true); setShotMsg(null)
    try {
      let url = await compressImage(file)
      if (url.length > 600_000) url = await compressImage(file, 1000, 0.6)
      const h = getStorageHealth()
      const after = (h.used - (shot?.length ?? 0) + url.length) / STORAGE_LIMIT_CHARS
      setShot(url)
      setShotMsg(after >= STORAGE_WARN_RATIO
        ? `⚠ Storage will be ~${Math.round(after * 100)}% full after saving (${formatBytesish(url.length)} image). Consider exporting a JSON backup and removing old screenshots.`
        : `Compressed to ${formatBytesish(url.length)}.`)
    } catch (e) {
      setShotMsg((e as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function save() {
    setTouched(true)
    if (!ok || !spec) return
    const now = new Date().toISOString()
    const t: Trade = {
      id: mode === 'edit' && initial ? initial.id : newId(),
      datetime: f.datetime, symbol, side: f.side, qty, entry, exit,
      stop: stop != null && Number.isFinite(stop) ? stop : null,
      fees, strategy: f.strategy, notes: f.notes.trim(),
      tickSize: spec.tickSize, tickValue: spec.tickValue, currency: spec.currency,
      ...(spec.priceFormat ? { priceFormat: spec.priceFormat } : {}),
      ...(shot ? { screenshot: shot } : {}),
      ...(f.accountId ? { accountId: f.accountId } : {}),
      createdAt: mode === 'edit' && initial ? initial.createdAt : now,
      updatedAt: now,
    }
    onSave(t)
  }

  const err = (k: string) => (touched && errors[k] ? <span className="ferr">{errors[k]}</span> : null)
  const title = mode === 'edit' ? 'Edit trade' : mode === 'duplicate' ? 'Duplicate trade' : 'New trade'
  const allStrategies = f.strategy && !strategies.includes(f.strategy) ? [...strategies, f.strategy] : strategies

  return (
    <Modal title={title} onClose={onClose} wide footer={<>
      <div className="foot-pnl">
        {calc ? <>Net <b className={calc.net > 0 ? 'pos' : calc.net < 0 ? 'neg' : ''} data-testid="form-net">{formatMoney(calc.net, cur, 2)}</b></> : <span className="muted">Enter prices to see P&L</span>}
      </div>
      <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={save} disabled={busy}>{mode === 'edit' ? 'Save changes' : 'Save trade'}</button>
    </>}>
      <form className="trade-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="tf-grid">
          <label className="span2">Contract
            <ContractPicker contracts={contracts} value={liveSpec} onChange={(c) => setSymbol(c.symbol)} />
            {err('symbol')}
          </label>
          <label>Date & time
            <input type="datetime-local" value={f.datetime} onChange={set('datetime')} name="datetime" />
            {err('datetime')}
          </label>
          <div className="lbl">Direction
            <div className="seg side" role="radiogroup" aria-label="Direction">
              {(['long', 'short'] as Side[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={f.side === s} className={f.side === s ? `on ${s}` : ''} onClick={() => setF({ ...f, side: s })}>
                  {s === 'long' ? 'Long' : 'Short'}
                </button>
              ))}
            </div>
          </div>
          <label><span className="lt">Entry{is32 && <small> (e.g. 110-16.5)</small>}</span>
            <input inputMode="decimal" name="entry" value={f.entry} onChange={set('entry')} className={touched && errors.entry ? 'bad' : ''} />
            {err('entry')}
          </label>
          <label>Exit
            <input inputMode="decimal" name="exit" value={f.exit} onChange={set('exit')} className={touched && errors.exit ? 'bad' : ''} />
            {err('exit')}
          </label>
          <label>Contracts
            <input inputMode="numeric" name="qty" value={f.qty} onChange={set('qty')} className={touched && errors.qty ? 'bad' : ''} />
            {err('qty')}
          </label>
          <label><span className="lt">Stop <small>(optional)</small></span>
            <input inputMode="decimal" name="stop" value={f.stop} onChange={set('stop')} />
            {err('stop')}
          </label>
          <label><span className="lt">Fees <small>({cur}, round-trip total)</small></span>
            <input inputMode="decimal" name="fees" value={f.fees} onChange={set('fees')} />
            {err('fees')}
          </label>
          <label>Strategy
            <div className="with-btn">
              <select name="strategy" value={f.strategy} onChange={set('strategy')}>
                <option value="">(none)</option>
                {allStrategies.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" className="btn ghost sm" onClick={onManageStrategies} title="Edit strategy list">Edit list</button>
            </div>
          </label>
          {(accounts.length > 0 || f.accountId) && (
            <label className="span2"><span className="lt">Prop account <small>(optional)</small></span>
              <select name="accountId" value={f.accountId} onChange={set('accountId')}>
                <option value="">None</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.status !== 'active' ? ` (${a.status})` : ''}</option>)}
                {f.accountId && !accounts.some((a) => a.id === f.accountId) && <option value={f.accountId}>(deleted account)</option>}
              </select>
            </label>
          )}
          <label className="span2">Notes
            <textarea name="notes" rows={3} value={f.notes} onChange={set('notes')} placeholder="Setup, execution, emotions…" />
          </label>
          <div className="lbl span2"><span className="lt">Screenshot <small>(optional, compressed, stored on this device)</small></span>
            <div className="shot-row">
              {shot ? <img src={shot} alt="Trade screenshot" className="shot-thumb" /> : <div className="shot-empty">No image</div>}
              <div className="shot-actions">
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} hidden />
                <button type="button" className="btn sm" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Compressing…' : shot ? 'Replace image' : 'Attach image'}</button>
                {shot && <button type="button" className="btn ghost sm" onClick={() => { setShot(undefined); setShotMsg(null) }}>Remove</button>}
              </div>
            </div>
            {shotMsg && <p className={shotMsg.startsWith('⚠') ? 'warn' : 'hint'}>{shotMsg}</p>}
          </div>
        </div>

        <div className="tf-calc" aria-live="polite">
          <div><span>Points</span><b>{calc ? formatNumber(calc.points, 6) : '—'}</b></div>
          <div><span>Ticks</span><b>{calc ? formatNumber(calc.ticks, 2) : '—'}</b></div>
          <div><span>Gross</span><b>{calc ? formatMoney(calc.gross, cur, 2) : '—'}</b></div>
          <div><span>Fees</span><b>{calc ? formatMoney(-calc.fees, cur, 2) : '—'}</b></div>
          <div><span>Net P&L</span><b className={calc ? (calc.net > 0 ? 'pos' : calc.net < 0 ? 'neg' : '') : ''}>{calc ? formatMoney(calc.net, cur, 2) : '—'}</b></div>
          <div><span>R</span><b>{calc?.r != null ? `${calc.r > 0 ? '+' : ''}${formatNumber(calc.r, 2)}R` : '—'}</b></div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

interface SMProps {
  strategies: string[]
  usage: Record<string, number>
  onChange: (list: string[]) => void
  onRename: (from: string, to: string) => void
  onClose: () => void
}

export function StrategyManager({ strategies, usage, onChange, onRename, onClose }: SMProps) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ i: number; v: string } | null>(null)
  const add = () => {
    const v = draft.trim()
    if (!v || strategies.some((s) => s.toLowerCase() === v.toLowerCase())) return
    onChange([...strategies, v]); setDraft('')
  }
  const commit = () => {
    if (!editing) return
    const v = editing.v.trim(), old = strategies[editing.i]
    if (v && v !== old && !strategies.some((s, j) => j !== editing.i && s.toLowerCase() === v.toLowerCase())) onRename(old, v)
    setEditing(null)
  }
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= strategies.length) return
    const next = strategies.slice(); [next[i], next[j]] = [next[j], next[i]]; onChange(next)
  }
  return (
    <Modal title="Strategies" onClose={onClose} footer={<button type="button" className="btn primary" onClick={onClose}>Done</button>}>
      <ul className="strat-list">
        {strategies.map((s, i) => (
          <li key={s}>
            {editing?.i === i ? (
              <input autoFocus value={editing.v} onChange={(e) => setEditing({ i, v: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null) }} onBlur={commit} />
            ) : (
              <span className="sname">{s} <em>{usage[s] ? `${usage[s]} trade${usage[s] > 1 ? 's' : ''}` : ''}</em></span>
            )}
            <div className="sact">
              <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label="Move up"><IconUp /></button>
              <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label="Move down"><IconDown /></button>
              <button type="button" className="icon-btn" onClick={() => setEditing({ i, v: s })} aria-label={`Rename ${s}`}><IconEdit /></button>
              <button type="button" className="icon-btn" onClick={() => onChange(strategies.filter((x) => x !== s))} aria-label={`Delete ${s}`}><IconTrash /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="with-btn">
        <input placeholder="New strategy name" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <button type="button" className="btn primary sm" onClick={add}>Add</button>
      </div>
      <p className="hint">Renaming updates existing trades. Deleting only removes it from the list; past trades keep their label.</p>
    </Modal>
  )
}
