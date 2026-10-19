import type { Trade } from '../data/types'
import { CONTRACT_BY_SYMBOL } from '../data/contracts'
import { snapshotSpec } from './journal'

/** EXAMPLE trades for demos/screenshots only. All flagged sample:true and labelled in notes. */
const rows: [string, string, 'long' | 'short', number, number, number, number | null, number, string, string][] = [
  // datetime, symbol, side, qty, entry, exit, stop, fees, strategy, notes
  ['2026-10-05T09:42', 'MNQ', 'long', 5, 20112.25, 20131.5, 20101, 3.7, 'ORB', 'Opening range break, held above VWAP'],
  ['2026-10-05T10:58', 'MES', 'short', 3, 5841.5, 5846.75, 5848, 2.22, 'Reversal', 'Faded the high too early — stopped'],
  ['2026-10-06T09:47', 'ES', 'long', 1, 5852.25, 5861.0, 5847.5, 4.5, 'VWAP bounce', 'Clean VWAP retest'],
  ['2026-10-06T13:15', 'CL', 'short', 1, 71.42, 71.18, 71.6, 4.2, 'Breakout', 'Inventory breakdown'],
  ['2026-10-07T09:35', 'MNQ', 'long', 10, 20240.0, 20228.5, 20226, 7.4, 'ORB', 'False break, cut it'],
  ['2026-10-07T03:10', 'FDAX', 'long', 1, 19412, 19446, 19395, 4.0, 'Pullback', 'London session pullback to 20 EMA'],
  ['2026-10-08T10:05', 'GC', 'long', 1, 2662.4, 2671.9, 2657.0, 4.6, 'Pullback', 'Bought dip into prior high'],
  ['2026-10-08T14:20', 'ZN', 'short', 2, 110.5, 110.40625, 110.578125, 4.4, 'Breakout', 'Sold 110-16, covered 110-13'],
  ['2026-10-09T04:02', 'FESX', 'short', 2, 4981, 4989, 4990, 3.6, 'Reversal', 'Stopped at the high'],
  ['2026-10-09T09:51', 'MES', 'long', 4, 5866.0, 5874.25, 5861.75, 2.96, 'VWAP bounce', 'Second VWAP touch'],
  ['2026-10-12T09:40', 'NQ', 'short', 1, 20310.5, 20288.25, 20322, 4.5, 'ORB', 'Downside ORB'],
  ['2026-10-12T11:30', 'MCL', 'long', 3, 70.95, 70.88, 70.8, 1.95, 'Pullback', 'Chopped out'],
  ['2026-10-13T09:33', 'MNQ', 'long', 5, 20355.5, 20372.0, 20345, 3.7, 'Breakout', 'Premarket high break'],
  ['2026-10-14T02:45', 'FDXM', 'short', 3, 19520, 19498, 19534, 3.0, 'ORB', 'Xetra open ORB short'],
  ['2026-10-15T10:12', 'ES', 'short', 2, 5890.75, 5893.25, 5895, 9.0, 'Reversal', 'Small loss'],
]

export function sampleTrades(): Trade[] {
  const now = new Date().toISOString()
  return rows.map(([datetime, symbol, side, qty, entry, exit, stop, fees, strategy, notes], i) => ({
    id: `sample-${String(i + 1).padStart(2, '0')}`,
    datetime, symbol, side, qty, entry, exit, stop, fees, strategy,
    notes: `SAMPLE DATA — ${notes}`,
    ...snapshotSpec(CONTRACT_BY_SYMBOL[symbol]),
    sample: true,
    createdAt: now,
    updatedAt: now,
  }))
}

// ───────────────────────── Prop-firm SAMPLE accounts ─────────────────────────
import { PRESET_BY_ID } from '../data/propFirms'
import { accountFromPreset, nowLocalDateTime, sessionDate, type PropAccount } from './prop'

const pad2 = (n: number) => String(n).padStart(2, '0')
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** The `n` most recent completed weekday sessions before today's session, oldest first. */
function pastSessions(n: number, now: Date): string[] {
  const today = sessionDate(nowLocalDateTime(now))
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  while (out.length < n) {
    d.setDate(d.getDate() - 1)
    const s = ymdLocal(d)
    if (d.getDay() !== 0 && d.getDay() !== 6 && s < today) out.push(s)
  }
  return out.reverse()
}

type DayPlan = [symbol: string, side: 'long' | 'short', qty: number, net: number, time: string][]

const PROP_SAMPLES: { id: string; preset: string; name: string; plan: DayPlan[]; today?: DayPlan }[] = [
  {
    id: 'sample-acct-1', preset: 'apex-eod-trailing-eval-50k', name: 'SAMPLE · Apex 50K EOD eval',
    plan: [
      [['NQ', 'long', 1, 650, '09:44']],
      [['MNQ', 'long', 5, 520, '09:38'], ['MNQ', 'short', 5, 300, '11:05']],
      [['NQ', 'short', 1, -380, '10:12']],
      [['ES', 'long', 1, 540, '09:51']],
      [['MES', 'long', 6, 410, '13:20']],
    ],
    today: [['NQ', 'long', 1, -450, '']],
  },
  {
    id: 'sample-acct-2', preset: 'topstep-trading-combine-eval-150k', name: 'SAMPLE · Topstep 150K Combine',
    plan: [
      [['ES', 'long', 3, 1800, '09:40']],
      [['NQ', 'long', 2, 2600, '09:47']],
      [['ES', 'short', 2, -600, '10:30']],
      [['MNQ', 'long', 10, 900, '09:35']],
      [['NQ', 'short', 2, 1200, '14:05']],
    ],
  },
  {
    id: 'sample-acct-3', preset: 'tradeday-quick-pay-intraday-eval-50k', name: 'SAMPLE · TradeDay 50K intraday',
    plan: [
      [['NQ', 'long', 2, 1300, '09:42']],
      [['NQ', 'short', 1, -700, '10:02']],
      [['ES', 'long', 2, -900, '11:15']],
    ],
  },
  {
    id: 'sample-acct-4', preset: 'lucid-lucidpro-eval-25k', name: 'SAMPLE · Lucid 25K Pro eval',
    plan: [
      [['MES', 'long', 10, 610, '09:36']],
      [['MNQ', 'long', 8, 790, '09:58']],
    ],
  },
]

const BASE: Record<string, number> = { NQ: 20310, MNQ: 20310, ES: 5880, MES: 5880 }

export function samplePropData(now = new Date()): { accounts: PropAccount[]; trades: Trade[] } {
  const iso = now.toISOString()
  const accounts: PropAccount[] = []
  const trades: Trade[] = []
  let n = 0
  for (const s of PROP_SAMPLES) {
    const days = pastSessions(s.plan.length, now)
    const a = accountFromPreset(PRESET_BY_ID[s.preset], { startDate: days[0], name: s.name })
    accounts.push({ ...a, id: s.id, sample: true })
    const todayTime = nowLocalDateTime(new Date(now.getTime() - 25 * 60_000))
    const legs: [string, DayPlan[number]][] = [
      ...s.plan.flatMap((day, i) => day.map((leg) => [`${days[i]}T${leg[4]}`, leg] as [string, DayPlan[number]])),
      ...(s.today ?? []).map((leg) => [todayTime, leg] as [string, DayPlan[number]]),
    ]
    for (const [datetime, [symbol, side, qty, net, _t]] of legs) {
      void _t
      const spec = CONTRACT_BY_SYMBOL[symbol]
      const fees = Math.round(qty * (spec.pointValue >= 20 ? 4.5 : 0.74) * 100) / 100
      const pts = Math.round(((net + fees) / (spec.pointValue * qty)) / spec.tickSize) * spec.tickSize
      const entry = BASE[symbol] + (n % 7) * 3.25
      const exit = side === 'long' ? entry + pts : entry - pts
      n++
      trades.push({
        id: `sample-p-${String(n).padStart(2, '0')}`,
        datetime, symbol, side, qty, entry, exit,
        stop: side === 'long' ? entry - 10 : entry + 10,
        fees, strategy: net >= 0 ? 'ORB' : 'Reversal',
        notes: `SAMPLE DATA — prop account demo (${s.name.replace('SAMPLE · ', '')})`,
        ...snapshotSpec(spec),
        accountId: s.id,
        sample: true,
        createdAt: iso, updatedAt: iso,
      })
    }
  }
  return { accounts, trades }
}
