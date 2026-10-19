import { useRef, useState } from 'react'
import type { ContractSpec, Trade } from '../data/types'
import { mergeTrades, tradesFromCSV, tradesToCSV } from '../lib/csv'
import { downloadText, makeBackup, parseBackup, stamp, type Backup } from '../lib/backup'
import { sampleTrades } from '../lib/sample'
import { formatBytesish, useStorageHealth } from '../lib/storage'
import { ConfirmDialog } from '../components/Modal'

interface Props {
  trades: Trade[]
  setTrades: (t: Trade[] | ((p: Trade[]) => Trade[])) => void
  contracts: ContractSpec[]
  customContracts: ContractSpec[]
  setCustomContracts: (c: ContractSpec[]) => void
  strategies: string[]
  setStrategies: (s: string[]) => void
}

export function DataView({ trades, setTrades, contracts, customContracts, setCustomContracts, strategies, setStrategies }: Props) {
  const csvRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pendingRestore, setPendingRestore] = useState<Backup | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const health = useStorageHealth()
  const hasSample = trades.some((t) => t.sample)
  const shots = trades.filter((t) => t.screenshot).length

  async function importCSV(file?: File) {
    if (!file) return
    const text = await file.text()
    const r = tradesFromCSV(text, contracts)
    if (!r.trades.length) { setMsg({ kind: 'err', text: `Nothing imported. ${r.errors.slice(0, 5).join('; ')}` }); return }
    const m = mergeTrades(trades, r.trades)
    setTrades(m.trades)
    setMsg({ kind: r.errors.length ? 'err' : 'ok', text: `Imported ${r.trades.length} trades (${m.added} new, ${m.updated} updated).${r.errors.length ? ` Skipped ${r.errors.length} rows: ${r.errors.slice(0, 3).join('; ')}${r.errors.length > 3 ? '…' : ''}` : ''}` })
  }

  async function pickBackup(file?: File) {
    if (!file) return
    try { setPendingRestore(parseBackup(await file.text())) }
    catch (e) { setMsg({ kind: 'err', text: `Restore failed: ${(e as Error).message}` }) }
  }

  return (
    <div className="data-grid">
      <div className="panel">
        <h3>Trades CSV</h3>
        <p className="hint">Spreadsheet-friendly. Re-importing a file updates trades with the same <code>id</code> and adds new ones. Screenshots aren’t included in CSV; use the JSON backup for those.</p>
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={!trades.length}
            onClick={() => downloadText(`futures-trades-${stamp()}.csv`, '\uFEFF' + tradesToCSV(trades), 'text/csv;charset=utf-8')}>Export CSV ({trades.length})</button>
          <button type="button" className="btn" onClick={() => csvRef.current?.click()}>Import CSV…</button>
          <input ref={csvRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-input" onChange={(e) => { importCSV(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>

      <div className="panel">
        <h3>Full backup (JSON)</h3>
        <p className="hint">Everything: trades (with screenshots), custom contracts and your strategy list. Restoring <b>replaces</b> what’s on this device.</p>
        <div className="btn-row">
          <button type="button" className="btn primary"
            onClick={() => downloadText(`futures-desk-backup-${stamp()}.json`, JSON.stringify(makeBackup({ trades, customContracts, strategies })), 'application/json')}>Download backup</button>
          <button type="button" className="btn" onClick={() => jsonRef.current?.click()}>Restore backup…</button>
          <input ref={jsonRef} type="file" accept=".json,application/json" hidden data-testid="json-input" onChange={(e) => { pickBackup(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>

      <div className="panel">
        <h3>On-device storage</h3>
        <div className={`meter ${health.nearLimit ? 'warn' : ''}`}><div style={{ width: `${Math.min(100, health.ratio * 100)}%` }} /></div>
        <p className="hint">{formatBytesish(health.used)} used of ~{formatBytesish(health.limit)} browser limit · {trades.length} trades · {shots} screenshots</p>
        {health.nearLimit && <p className="warn">Storage is nearly full. Download a backup, then remove some screenshots.</p>}
      </div>

      <div className="panel">
        <h3>Sample data</h3>
        <p className="hint">Load 15 EXAMPLE trades (clearly marked “Sample”) to try the journal and stats. They’re off by default and can be removed in one click; your own trades are untouched.</p>
        <div className="btn-row">
          {!hasSample
            ? <button type="button" className="btn" onClick={() => { setTrades((p) => [...p.filter((t) => !t.sample), ...sampleTrades()]); setMsg({ kind: 'ok', text: 'Sample trades loaded.' }) }}>Load sample data</button>
            : <button type="button" className="btn" onClick={() => { setTrades((p) => p.filter((t) => !t.sample)); setMsg({ kind: 'ok', text: 'Sample trades removed.' }) }}>Remove sample data</button>}
          <button type="button" className="btn ghost danger-text" disabled={!trades.length} onClick={() => setConfirmClear(true)}>Delete all trades…</button>
        </div>
      </div>

      {msg && <p className={`toast ${msg.kind}`} role="status" onClick={() => setMsg(null)}>{msg.text}</p>}

      {pendingRestore && (
        <ConfirmDialog
          title="Restore backup?"
          confirmLabel="Replace & restore"
          danger
          message={<>This replaces your current {trades.length} trades, {customContracts.length} custom contracts and strategy list with the backup from <b>{pendingRestore.exportedAt.slice(0, 16).replace('T', ' ')} UTC</b>: {pendingRestore.trades.length} trades, {pendingRestore.customContracts.length} custom contracts, {pendingRestore.strategies.length} strategies.</>}
          onCancel={() => setPendingRestore(null)}
          onConfirm={() => {
            setTrades(pendingRestore.trades)
            setCustomContracts(pendingRestore.customContracts)
            setStrategies(pendingRestore.strategies)
            setMsg({ kind: 'ok', text: `Restored ${pendingRestore.trades.length} trades.` })
            setPendingRestore(null)
          }}
        />
      )}
      {confirmClear && (
        <ConfirmDialog title="Delete all trades?" danger confirmLabel="Delete all"
          message={<>Permanently delete all {trades.length} trades on this device? Consider downloading a backup first.</>}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => { setTrades([]); setConfirmClear(false); setMsg({ kind: 'ok', text: 'All trades deleted.' }) }} />
      )}
    </div>
  )
}
