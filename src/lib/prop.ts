import type { ContractSpec, Trade } from '../data/types'
import { FIRM_BY_ID, type PropPhase, type PropPreset, type PropRules, type Verification } from '../data/propFirms'
import { computeTrade, newId } from './journal'

export type AccountStatus = 'active' | 'passed' | 'blown'

export interface PropAccount {
  id: string
  name: string
  /** Firm id from PROP_FIRMS, or 'custom'. */
  firmId: string
  presetId: string | null
  program: string
  size: number
  phase: PropPhase
  /** YYYY-MM-DD; trades from sessions before this date are ignored. */
  startDate: string
  startingBalance: number
  status: AccountStatus
  rules: PropRules
  sourceUrl?: string
  lastVerified?: string
  verification?: Verification | 'custom'
  unverified?: string
  /** true once the user changed any preset value. */
  edited?: boolean
  sample?: boolean
  createdAt: string
  updatedAt: string
}

export function accountFromPreset(p: PropPreset, opts: { startDate: string; startingBalance?: number; name?: string }): PropAccount {
  const now = new Date().toISOString()
  const firm = FIRM_BY_ID[p.firmId]?.name ?? p.firmId
  return {
    id: newId(),
    name: opts.name?.trim() || `${firm} ${p.size / 1000}K ${p.phase === 'evaluation' ? 'Eval' : 'Funded'}`,
    firmId: p.firmId, presetId: p.id, program: p.program, size: p.size, phase: p.phase,
    startDate: opts.startDate,
    startingBalance: opts.startingBalance ?? p.size,
    status: 'active',
    rules: { ...p.rules },
    sourceUrl: p.sourceUrl, lastVerified: p.lastVerified, verification: p.verification,
    ...(p.unverified ? { unverified: p.unverified } : {}),
    createdAt: now, updatedAt: now,
  }
}

// ───────────────────────── sessions ─────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Futures session date for a local "YYYY-MM-DDTHH:mm" time (assumed US Eastern):
 * the session rolls at 6:00 PM ET, so an evening trade belongs to the next
 * trading day. A Friday/Saturday evening rolls to Monday.
 */
export function sessionDate(datetime: string): string {
  const [d, t = '00:00'] = datetime.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const hour = Number(t.slice(0, 2))
  const dt = new Date(y, m - 1, day, 12)
  if (hour >= 18) dt.setDate(dt.getDate() + 1)
  const wd = dt.getDay()
  if (wd === 6) dt.setDate(dt.getDate() + 2)
  else if (wd === 0) dt.setDate(dt.getDate() + 1)
  return ymd(dt)
}

export function nowLocalDateTime(now = new Date()): string {
  return `${ymd(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// ───────────────────────── account math ─────────────────────────

export type Health = 'ok' | 'warning' | 'breached' | 'target'
export const WARN_RATIO = 0.25

export interface PropPoint { date: string; balance: number; threshold: number; pnl: number }

export interface PropSummary {
  balance: number
  profit: number
  threshold: number
  initialThreshold: number
  lockLevel: number | null
  locked: boolean
  distanceToDD: number
  todayPnl: number
  todaySession: string
  dllRoom: number | null
  targetProgress: number | null
  targetRemaining: number | null
  largestDay: number
  consistencyPct: number | null
  consistencyOk: boolean | null
  /** Total profit needed for the largest day to satisfy the rule. */
  consistencyNeeded: number | null
  tradingDays: number
  minDaysOk: boolean | null
  breachedAt: string | null
  health: Health
  reasons: string[]
  series: PropPoint[]
  tradeCount: number
  /** Linked trades not in USD (excluded — prop accounts are USD). */
  skipped: number
}

const EPS = 1e-9

export function lockLevelOf(acct: Pick<PropAccount, 'startingBalance' | 'rules'>): number | null {
  const r = acct.rules
  return r.drawdownType === 'static' || r.trailLockOffset == null ? null : acct.startingBalance + r.trailLockOffset
}

export function computeProp(acct: PropAccount, allTrades: Trade[], now = new Date()): PropSummary {
  const r = acct.rules
  const start = acct.startingBalance
  const initial = start - r.maxDrawdown
  const lock = lockLevelOf(acct)
  const trail = (peak: number) => (lock == null ? peak - r.maxDrawdown : Math.min(peak - r.maxDrawdown, lock))
  const todaySession = sessionDate(nowLocalDateTime(now))

  const mine = allTrades.filter((t) => t.accountId === acct.id)
  const usable = mine
    .filter((t) => t.currency === 'USD' && sessionDate(t.datetime) >= acct.startDate)
    .sort((a, b) => a.datetime.localeCompare(b.datetime) || a.createdAt.localeCompare(b.createdAt))
  const skipped = mine.filter((t) => t.currency !== 'USD').length

  let bal = start
  let peak = start
  let threshold = initial
  let breachedAt: string | null = null
  const series: PropPoint[] = []
  const dayPnl = new Map<string, number>()

  for (let i = 0; i < usable.length; i++) {
    const t = usable[i]
    const day = sessionDate(t.datetime)
    const net = computeTrade(t).net
    bal += net
    dayPnl.set(day, (dayPnl.get(day) ?? 0) + net)
    if (r.drawdownType === 'intraday') {
      // Approximation: without tick data, each trade's peak is its closed result.
      peak = Math.max(peak, bal)
      threshold = Math.max(threshold, trail(peak))
    }
    if (!breachedAt && bal <= threshold + EPS) breachedAt = t.datetime

    const lastOfDay = i === usable.length - 1 || sessionDate(usable[i + 1].datetime) !== day
    if (lastOfDay) {
      // EOD trails on the session's closing balance, applied after the close
      // (not for the session that is still open today).
      if (r.drawdownType === 'eod' && day < todaySession) {
        peak = Math.max(peak, bal)
        threshold = Math.max(threshold, trail(peak))
      }
      series.push({ date: day, balance: bal, threshold, pnl: dayPnl.get(day)! })
    }
  }

  const profit = bal - start
  const distanceToDD = bal - threshold
  const todayPnl = dayPnl.get(todaySession) ?? 0
  const dllRoom = r.dailyLossLimit == null ? null : Math.max(0, r.dailyLossLimit + todayPnl)
  const targetProgress = r.profitTarget ? Math.max(0, profit / r.profitTarget) : null
  const targetRemaining = r.profitTarget ? Math.max(0, r.profitTarget - profit) : null

  const largestDay = Math.max(0, ...dayPnl.values())
  const consistencyPct = profit > 0 && largestDay > 0 ? (largestDay / profit) * 100 : null
  const consistencyOk = r.consistencyPct == null ? null : consistencyPct != null && consistencyPct <= r.consistencyPct + EPS
  const consistencyNeeded = r.consistencyPct != null && largestDay > 0 ? largestDay / (r.consistencyPct / 100) : null
  const tradingDays = dayPnl.size
  const minDaysOk = r.minTradingDays == null ? null : tradingDays >= r.minTradingDays

  const reasons: string[] = []
  let health: Health = 'ok'
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

  if (breachedAt || distanceToDD <= EPS) {
    health = 'breached'
    reasons.push(`Drawdown limit touched${breachedAt ? ` on ${breachedAt.slice(0, 10)}` : ''}`)
  }
  if (r.dailyLossLimit != null && dllRoom != null && dllRoom <= EPS) {
    health = 'breached'
    reasons.push('Daily loss limit reached today')
  }
  if (health !== 'breached') {
    const targetHit = r.profitTarget != null && profit >= r.profitTarget - EPS
    if (targetHit) {
      const missing: string[] = []
      if (consistencyOk === false) missing.push(`consistency ${consistencyPct == null ? '—' : consistencyPct.toFixed(0) + '%'} > ${r.consistencyPct}% (need ${money(consistencyNeeded ?? 0)} total)`)
      if (minDaysOk === false) missing.push(`${tradingDays}/${r.minTradingDays} trading days`)
      if (missing.length) { health = 'warning'; reasons.push(`Target reached, but ${missing.join(' and ')}`) }
      else { health = 'target'; reasons.push('Profit target reached') }
    }
    if (distanceToDD <= r.maxDrawdown * WARN_RATIO) {
      health = 'warning'
      reasons.push(`Within ${money(distanceToDD)} of the drawdown limit`)
    }
    if (r.dailyLossLimit != null && dllRoom != null && dllRoom <= r.dailyLossLimit * WARN_RATIO) {
      health = 'warning'
      reasons.push(`Only ${money(dllRoom)} left of today's loss limit`)
    }
  }

  return {
    balance: bal, profit, threshold, initialThreshold: initial, lockLevel: lock,
    locked: lock != null && threshold >= lock - EPS,
    distanceToDD, todayPnl, todaySession, dllRoom, targetProgress, targetRemaining,
    largestDay, consistencyPct, consistencyOk, consistencyNeeded, tradingDays, minDaysOk,
    breachedAt, health, reasons, series, tradeCount: usable.length, skipped,
  }
}

// ───────────────────────── calculator check ─────────────────────────

export const isMicro = (spec: Pick<ContractSpec, 'name' | 'symbol'>) => /^micro\b|\bmicro\b/i.test(spec.name)

export function maxContractsFor(rules: PropRules, spec: Pick<ContractSpec, 'name' | 'symbol'>): number | null {
  return isMicro(spec) ? rules.maxMicros ?? (rules.maxMinis != null ? rules.maxMinis * 10 : null) : rules.maxMinis
}

export interface RiskCheck {
  risk: number
  leftDD: number
  leftDLL: number | null
  breachDD: boolean
  breachDLL: boolean
  /** Most contracts whose stop-out stays strictly inside both limits. */
  maxByRoom: number | null
  maxContracts: number | null
  overMax: boolean
}

export function riskCheck(o: { riskPerContract: number; qty: number; ddRoom: number; dllRoom: number | null; maxContracts: number | null }): RiskCheck {
  const risk = o.riskPerContract * o.qty
  const leftDD = o.ddRoom - risk
  const leftDLL = o.dllRoom == null ? null : o.dllRoom - risk
  const room = o.dllRoom == null ? o.ddRoom : Math.min(o.ddRoom, o.dllRoom)
  let maxByRoom: number | null = null
  if (o.riskPerContract > 0) {
    maxByRoom = Math.max(0, Math.ceil(room / o.riskPerContract - EPS) - 1)
    if (o.maxContracts != null) maxByRoom = Math.min(maxByRoom, o.maxContracts)
  }
  return {
    risk, leftDD, leftDLL,
    breachDD: leftDD <= EPS,
    breachDLL: leftDLL != null && leftDLL <= EPS,
    maxByRoom,
    maxContracts: o.maxContracts,
    overMax: o.maxContracts != null && o.qty > o.maxContracts,
  }
}
