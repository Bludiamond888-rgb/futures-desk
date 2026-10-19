import { CURRENCIES, type ContractSpec, type Currency, type Trade } from '../data/types'
import { computeTrade, newId, snapshotSpec } from './journal'

/**
 * CSV columns. The first block round-trips; the computed block (points … netPnl)
 * is exported for spreadsheet convenience and ignored on import.
 * Screenshots are NOT included in CSV (use the JSON backup for those).
 */
export const CSV_COLUMNS = [
  'id', 'datetime', 'symbol', 'side', 'qty', 'entry', 'exit', 'stop', 'fees', 'strategy', 'notes',
  'tickSize', 'tickValue', 'currency', 'priceFormat', 'createdAt', 'updatedAt',
  'points', 'ticks', 'grossPnl', 'netPnl',
] as const

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function tradesToCSV(trades: Trade[]): string {
  const rows = [CSV_COLUMNS.join(',')]
  for (const t of trades) {
    const c = computeTrade(t)
    const rec: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      id: t.id, datetime: t.datetime, symbol: t.symbol, side: t.side, qty: t.qty, entry: t.entry, exit: t.exit,
      stop: t.stop ?? '', fees: t.fees, strategy: t.strategy, notes: t.notes,
      tickSize: t.tickSize, tickValue: t.tickValue, currency: t.currency, priceFormat: t.priceFormat ?? '',
      createdAt: t.createdAt, updatedAt: t.updatedAt,
      points: c.points, ticks: c.ticks, grossPnl: c.gross, netPnl: c.net,
    }
    rows.push(CSV_COLUMNS.map((k) => esc(rec[k])).join(','))
  }
  return rows.join('\r\n') + '\r\n'
}

/** RFC 4180 parser: quoted fields, escaped quotes, embedded commas/newlines, CRLF or LF. */
export function parseCSV(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let quoted = false
  while (i < s.length) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"' && field === '') { quoted = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\r' || ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      if (ch === '\r' && s[i + 1] === '\n') i++
      i++; continue
    }
    field += ch; i++
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export interface ImportResult { trades: Trade[]; errors: string[] }

const num = (s: string | undefined) => (s == null || s.trim() === '' ? NaN : Number(s.trim()))

export function tradesFromCSV(text: string, contracts: ContractSpec[]): ImportResult {
  const rows = parseCSV(text)
  const errors: string[] = []
  if (!rows.length) return { trades: [], errors: ['File is empty'] }
  const header = rows[0].map((h) => h.trim())
  const idx = (k: string) => header.indexOf(k)
  for (const req of ['datetime', 'symbol', 'side', 'qty', 'entry', 'exit']) {
    if (idx(req) < 0) errors.push(`Missing column "${req}"`)
  }
  if (errors.length) return { trades: [], errors }
  const get = (r: string[], k: string) => (idx(k) >= 0 ? r[idx(k)] ?? '' : '')
  const out: Trade[] = []
  const now = new Date().toISOString()
  rows.slice(1).forEach((r, n) => {
    const line = n + 2
    const symbol = get(r, 'symbol').trim()
    const side = get(r, 'side').trim().toLowerCase()
    const qty = num(get(r, 'qty')), entry = num(get(r, 'entry')), exit = num(get(r, 'exit'))
    const datetime = get(r, 'datetime').trim()
    if (!symbol) return errors.push(`Row ${line}: missing symbol`)
    if (side !== 'long' && side !== 'short') return errors.push(`Row ${line}: side must be long/short`)
    if (!(qty > 0)) return errors.push(`Row ${line}: bad qty`)
    if (!Number.isFinite(entry) || !Number.isFinite(exit)) return errors.push(`Row ${line}: bad entry/exit`)
    if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(datetime)) return errors.push(`Row ${line}: bad datetime`)
    let tickSize = num(get(r, 'tickSize')), tickValue = num(get(r, 'tickValue'))
    let currency = get(r, 'currency').trim() as Currency
    let priceFormat = get(r, 'priceFormat').trim() as Trade['priceFormat'] | ''
    if (!(tickSize > 0) || !(tickValue > 0) || !CURRENCIES.includes(currency)) {
      const spec = contracts.find((c) => c.symbol === symbol)
      if (!spec) return errors.push(`Row ${line}: unknown contract ${symbol} and no tickSize/tickValue/currency columns`)
      const snap = snapshotSpec(spec)
      tickSize = snap.tickSize; tickValue = snap.tickValue; currency = snap.currency; priceFormat = snap.priceFormat ?? ''
    }
    const stop = num(get(r, 'stop'))
    const fees = num(get(r, 'fees'))
    const dt = datetime.replace(' ', 'T').slice(0, 16)
    const t: Trade = {
      id: get(r, 'id').trim() || newId(),
      datetime: dt.length === 10 ? dt + 'T00:00' : dt,
      symbol, side, qty, entry, exit,
      stop: Number.isFinite(stop) ? stop : null,
      fees: Number.isFinite(fees) ? fees : 0,
      strategy: get(r, 'strategy'),
      notes: get(r, 'notes'),
      tickSize, tickValue, currency,
      createdAt: get(r, 'createdAt').trim() || now,
      updatedAt: get(r, 'updatedAt').trim() || now,
    }
    if (priceFormat === '32nds' || priceFormat === 'decimal') t.priceFormat = priceFormat
    out.push(t)
  })
  return { trades: out, errors }
}

/** Merge imported trades: same id → replaced (keeping an existing screenshot), new id → added. */
export function mergeTrades(existing: Trade[], incoming: Trade[]): { trades: Trade[]; added: number; updated: number } {
  const map = new Map(existing.map((t) => [t.id, t]))
  let added = 0, updated = 0
  for (const t of incoming) {
    const prev = map.get(t.id)
    if (prev) { updated++; map.set(t.id, { ...t, screenshot: t.screenshot ?? prev.screenshot }) }
    else { added++; map.set(t.id, t) }
  }
  return { trades: [...map.values()], added, updated }
}
