/**
 * Prop-firm rule presets.
 *
 * Every value below was read from the firm's own public rules / help-center
 * page on the `lastVerified` date (Oct 18, 2026, America/New_York) using a real
 * browser. `sourceUrl` is the page the numbers came from.
 *
 *  verification: 'verified'   – every numeric field was stated on the source page
 *                'partial'    – some fields were not stated / were inferred; see `unverified`
 *
 * Rules change often. The UI always shows "Rules change often — confirm with your
 * firm" with the source link, and every value is editable per account.
 *
 * Conventions
 *  - maxDrawdown is a positive dollar distance below the reference balance.
 *  - trailLockOffset: trailing stops once the threshold reaches
 *      startingBalance + trailLockOffset  (0 = locks at the starting balance,
 *      100 = locks at start + $100). null = keeps trailing (or not stated).
 *  - consistencyPct: largest single (profitable) day ÷ total net profit must be
 *      at or below this percentage. null = no consistency rule for this phase.
 *  - maxMinis / maxMicros: position limits in contracts. Micros are usually 10:1.
 */

export type DrawdownType = 'intraday' | 'eod' | 'static'
export type PropPhase = 'evaluation' | 'funded'
export type Verification = 'verified' | 'partial' | 'unverified'

export const DRAWDOWN_LABEL: Record<DrawdownType, string> = {
  intraday: 'Trailing (intraday)',
  eod: 'Trailing (end of day)',
  static: 'Static',
}

export interface PropRules {
  profitTarget: number | null
  maxDrawdown: number
  drawdownType: DrawdownType
  trailLockOffset: number | null
  dailyLossLimit: number | null
  consistencyPct: number | null
  minTradingDays: number | null
  maxMinis: number | null
  maxMicros: number | null
  notes: string
}

export interface PropFirm {
  id: string
  name: string
  website: string
}

export interface PropPreset {
  id: string
  firmId: string
  program: string
  phase: PropPhase
  size: number
  rules: PropRules
  sourceUrl: string
  lastVerified: string
  verification: Verification
  /** Human list of what could not be confirmed on the source page. */
  unverified?: string
}

export const LAST_VERIFIED = '2026-10-18'

export const PROP_FIRMS: PropFirm[] = [
  { id: 'apex', name: 'Apex Trader Funding', website: 'https://apextraderfunding.com/' },
  { id: 'topstep', name: 'Topstep', website: 'https://www.topstep.com/' },
  { id: 'tpt', name: 'Take Profit Trader', website: 'https://takeprofittrader.com/' },
  { id: 'mffu', name: 'MyFundedFutures', website: 'https://myfundedfutures.com/' },
  { id: 'tradeify', name: 'Tradeify', website: 'https://tradeify.co/' },
  { id: 'bulenox', name: 'Bulenox', website: 'https://bulenox.com/' },
  { id: 'etf', name: 'Elite Trader Funding', website: 'https://elitetraderfunding.app/' },
  { id: 'tradeday', name: 'TradeDay', website: 'https://www.tradeday.com/' },
  { id: 'lucid', name: 'Lucid Trading', website: 'https://lucidtrading.com/' },
]
export const FIRM_BY_ID: Record<string, PropFirm> = Object.fromEntries(PROP_FIRMS.map((f) => [f.id, f]))

// ───────────────────────── builder helpers ─────────────────────────

type Col = (number | null)[]
interface Table {
  firmId: string
  program: string
  phase: PropPhase
  sizes: number[]
  target: Col
  dd: Col
  type: DrawdownType
  lock: number | null
  dll?: Col
  consistency?: number | null
  minDays?: number | null
  minis?: Col
  micros?: Col
  notes: string
  src: string
  verification?: Verification
  unverified?: string
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function table(t: Table): PropPreset[] {
  return t.sizes.map((size, i) => ({
    id: `${t.firmId}-${slug(t.program)}-${t.phase === 'evaluation' ? 'eval' : 'funded'}-${size / 1000}k`,
    firmId: t.firmId,
    program: t.program,
    phase: t.phase,
    size,
    rules: {
      profitTarget: t.target[i] ?? null,
      maxDrawdown: t.dd[i] as number,
      drawdownType: t.type,
      trailLockOffset: t.type === 'static' ? null : t.lock,
      dailyLossLimit: t.dll?.[i] ?? null,
      consistencyPct: t.consistency ?? null,
      minTradingDays: t.minDays ?? null,
      maxMinis: t.minis?.[i] ?? null,
      maxMicros: t.micros?.[i] ?? (t.minis?.[i] != null ? (t.minis[i] as number) * 10 : null),
      notes: t.notes,
    },
    sourceUrl: t.src,
    lastVerified: LAST_VERIFIED,
    verification: t.verification ?? 'verified',
    ...(t.unverified ? { unverified: t.unverified } : {}),
  }))
}

const K = (...n: number[]) => n.map((x) => x * 1000)
const NONE4: Col = [null, null, null, null]

// ───────────────────────── Apex Trader Funding ─────────────────────────
const APEX = 'https://apextraderfunding.com/help-center/'
const apex: PropPreset[] = [
  ...table({
    firmId: 'apex', program: 'Intraday Trailing', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4000], type: 'intraday', lock: null,
    dll: NONE4, consistency: null, minDays: null, minis: [4, 6, 8, 12],
    notes: 'Threshold follows peak balance including unrealized P&L. On Rithmic/WealthCharts it stops at the profit-target balance; on Tradovate it keeps trailing. No DLL, no minimum days, 30-day access. 10 micros = 1 mini.',
    src: `${APEX}evaluation-accounts-ea/intraday-trailing-drawdown-evaluations/`,
  }),
  ...table({
    firmId: 'apex', program: 'EOD Trailing', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4000], type: 'eod', lock: null,
    dll: [500, 1000, 1500, 2000], consistency: null, minDays: null, minis: [4, 6, 8, 12],
    notes: 'Threshold recalculated at 4:59:59 PM ET from the closing balance, enforced in real time. DLL pauses trading for the session (soft). No minimum days, 30-day access.',
    src: `${APEX}eod-trailing-drawdown-accounts/eod-evaluations/`,
  }),
  ...table({
    firmId: 'apex', program: 'Intraday Trailing', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4000], type: 'intraday', lock: 100,
    dll: [500, 1000, 1750, 2500], consistency: 50, minDays: null, minis: [1, 2, 3, 4],
    notes: 'Performance Account (PA). Trailing stops at starting balance + $100. Tier-based scaling: DLL and contracts shown are Level 1; the account max is 2 / 4 / 6 / 10 contracts as profit grows. 50% consistency applies to payout requests. Inactivity: two $50 days per 30 days.',
    src: `${APEX}intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-performance-accounts-pa/`,
  }),
  ...table({
    firmId: 'apex', program: 'EOD Trailing', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4000], type: 'eod', lock: 100,
    dll: [500, 1000, 1750, 2500], consistency: 50, minDays: null, minis: [1, 2, 3, 4],
    notes: 'Performance Account (PA). EOD threshold stops at starting balance + $100. Tier-based scaling: DLL and contracts shown are Level 1 (account max 2 / 4 / 6 / 10). 50% consistency applies to payout requests.',
    src: `${APEX}eod-trailing-drawdown-accounts/eod-performance-accounts-pa/`,
  }),
]

// ───────────────────────── Topstep ─────────────────────────
const TS = 'https://help.topstep.com/en/articles/'
const topstep: PropPreset[] = [
  ...table({
    firmId: 'topstep', program: 'Trading Combine', phase: 'evaluation', sizes: K(50, 100, 150),
    target: [3000, 6000, 9000], dd: [2000, 3000, 4500], type: 'eod', lock: 0,
    dll: [null, null, null], consistency: 55, minDays: 2, minis: [5, 10, 15],
    notes: 'Maximum Loss Limit trails end-of-day and stops at the starting balance. Optional DLL chosen at purchase ($1,000 / $2,000 / $3,000). Best day must stay ≤ 55% (exceeding it raises the target). Pass in as few as 2 days. Tier 1 news: brief restriction.',
    src: `${TS}8284197-trading-combine-parameters`,
  }),
  ...table({
    firmId: 'topstep', program: 'Express Funded (XFA)', phase: 'funded', sizes: K(50, 100, 150),
    target: [null, null, null], dd: [2000, 3000, 4500], type: 'eod', lock: 0,
    dll: [null, null, null], consistency: null, minDays: null,
    notes: 'XFA balance starts at $0 — set the starting balance to 0. MLL trails EOD and locks at $0; after the first payout the MLL is $0. Scaling Plan sets max contracts by balance (see TopstepX Risk Settings). Payout paths: 5 winning days ≥ $150, or consistency path (3 days, 40%).',
    src: `${TS}8284215-express-funded-account-parameters`,
    verification: 'partial', unverified: 'Scaling Plan contract tiers (shown as an image) — max contracts left blank.',
  }),
]

// ───────────────────────── Take Profit Trader ─────────────────────────
const TPT = 'https://takeprofittraderhelp.zendesk.com/hc/en-us/articles/'
const tpt: PropPreset[] = [
  ...table({
    firmId: 'tpt', program: 'Test', phase: 'evaluation', sizes: K(25, 50, 75, 100, 150),
    target: [1500, 3000, 4500, 6000, 9000], dd: [1500, 2000, 2500, 3000, 4500], type: 'eod', lock: 0,
    dll: [null, null, null, null, null], consistency: 50, minDays: 3, minis: [3, 6, 9, 12, 15],
    notes: 'EOD trailing drawdown, stops at the starting balance. Best day must be below 50% of net profit (otherwise target rises to 2× best day). Minimum 3 trading days. Homepage shows the DLL as removed.',
    src: `${TPT}15170265979165-Rule-3-Do-Not-Hit-End-Of-Day-EOD-Maximum-Trailing-Drawdown`,
  }),
  ...table({
    firmId: 'tpt', program: 'PRO', phase: 'funded', sizes: K(25, 50, 75, 100, 150),
    target: [null, null, null, null, null], dd: [1500, 2000, 2500, 3000, 4500], type: 'intraday', lock: 0,
    dll: [null, null, null, null, null], consistency: null, minDays: null, minis: [3, 6, 9, 12, 15],
    notes: 'PRO uses an INTRADAY trailing drawdown (includes unrealized) that stops at the starting balance. Must be flat 1 min before/after prohibited news. Trade at least one day per week. Scaling plan enforced on PRO.',
    src: `${TPT}15171769361053-PRO-Account-Rules`,
    verification: 'partial', unverified: 'PRO contract limits (scaling plan not published on the page) — test limits shown.',
  }),
]

// ───────────────────────── MyFundedFutures ─────────────────────────
const mffu: PropPreset[] = [
  ...table({
    firmId: 'mffu', program: 'Builder', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4500], type: 'eod', lock: null,
    dll: [600, 1000, 1750, 2500], consistency: null, minDays: 1, minis: [2, 4, 6, 9],
    notes: 'EOD trailing Max Loss. DLL is a soft pause. 50K has a $1,500 MLL add-on. News trading allowed. 7-day inactivity rule.',
    src: 'https://myfundedfutures.com/plans/builder',
  }),
  ...table({
    firmId: 'mffu', program: 'Builder', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4500], type: 'eod', lock: 100,
    dll: [600, 1000, 1750, 2500], consistency: 50, minDays: null, minis: [2, 4, 6, 9],
    notes: 'Sim-funded balance is shown from $0 at MFFU (enter 0 or the account size as you prefer). MLL lock level +$100. 50% consistency per payout cycle; buffer $1,100 / $2,100 / $3,100 / $4,600.',
    src: 'https://myfundedfutures.com/plans/builder',
  }),
  ...table({
    firmId: 'mffu', program: 'Pro', phase: 'evaluation', sizes: K(50, 100, 150),
    target: [3000, 6000, 9000], dd: [2000, 3000, 4500], type: 'eod', lock: null,
    dll: [null, null, null], consistency: 50, minDays: 2, minis: [3, 6, 9],
    notes: 'EOD Max Loss, no DLL, 50% consistency (eval only), minimum 2 days. Tier 1 news allowed in eval.',
    src: 'https://myfundedfutures.com/plans/pro',
  }),
  ...table({
    firmId: 'mffu', program: 'Pro', phase: 'funded', sizes: K(50, 100, 150),
    target: [null, null, null], dd: [2000, 3000, 4500], type: 'eod', lock: 100,
    dll: [null, null, null], consistency: null, minDays: null, minis: [3, 6, 9], micros: [30, 60, 90],
    notes: 'No DLL, no consistency once funded. Tier 1 news NOT allowed. Payouts 14 days from first trade after clearing the buffer ($2,100 / $3,100 / $4,600).',
    src: 'https://myfundedfutures.com/plans/pro',
    verification: 'partial', unverified: 'Lock level (+$100 inferred from the buffer); funded micro limit printed as "3 / 3" on the page — 10:1 assumed.',
  }),
]

// ───────────────────────── Tradeify ─────────────────────────
const TFY = 'https://help.tradeify.co/en/articles/'
const tradeify: PropPreset[] = [
  ...table({
    firmId: 'tradeify', program: 'Growth', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3500, 5000], type: 'eod', lock: null,
    dll: [600, 1250, 2500, 3750], consistency: null, minDays: 1, minis: [1, 4, 8, 12],
    notes: 'EOD trailing max drawdown (enforced in real time). DLL is a soft breach (pauses until 6 PM ET). No consistency in eval; pass in 1 day. News trading allowed.',
    src: `${TFY}10495915-growth-evaluation-accounts`,
  }),
  ...table({
    firmId: 'tradeify', program: 'Growth', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3500, 5000], type: 'eod', lock: 100,
    dll: [600, 1250, 2500, 3750], consistency: 35, minDays: null, minis: [1, 4, 8, 12],
    notes: 'Drawdown locks at start + $100 (or at first payout request). DLL rises to the drawdown amount after +6% profit. 35% consistency for payouts. Microscalping rule applies.',
    src: `${TFY}10495897-rules-trailing-max-drawdowns`,
    verification: 'partial', unverified: 'Funded drawdown/contract sizes assumed equal to the Growth evaluation.',
  }),
  ...table({
    firmId: 'tradeify', program: 'Select', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4500], type: 'eod', lock: null,
    dll: NONE4, consistency: 40, minDays: 3, minis: [1, 4, 8, 12],
    notes: 'EOD drawdown, no DLL in eval, 40% consistency (50% add-on available), minimum 3 days. Choose Flex (5-day) or Daily payouts after passing.',
    src: `${TFY}12853921-select-evaluation-accounts`,
  }),
  ...table({
    firmId: 'tradeify', program: 'Select Flex', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4500], type: 'eod', lock: 100,
    dll: NONE4, consistency: null, minDays: null, minis: [1, 4, 8, 12],
    notes: 'No DLL, EOD drawdown that locks at start + $100. Payouts every 5 winning days.',
    src: 'https://tradeify.co/',
    verification: 'partial', unverified: 'Funded contract limits assumed equal to the Select evaluation.',
  }),
  ...table({
    firmId: 'tradeify', program: 'Select Daily', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 2500, 3500], type: 'eod', lock: 100,
    dll: [500, 1000, 1250, 1750], consistency: null, minDays: null, minis: [1, 4, 8, 12],
    notes: 'Smaller drawdown with a soft DLL; daily payout eligibility after the buffer. Drawdown locks at start + $100.',
    src: `${TFY}10468321-rules-daily-loss-limit`,
    verification: 'partial', unverified: 'Funded contract limits assumed equal to the Select evaluation.',
  }),
]

// ───────────────────────── Bulenox ─────────────────────────
const bulenox: PropPreset[] = [
  ...table({
    firmId: 'bulenox', program: 'Option 1 · Trailing', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1500, 2500, 3000, 4500], type: 'intraday', lock: null,
    dll: NONE4, consistency: null, minDays: null, minis: [3, 7, 12, 15],
    notes: 'Qualification account. Trailing drawdown follows the highest point including open positions (commissions included). No DLL, no minimum days, full size from day one. No overnight holds; flat by 3:59 PM CT.',
    src: 'https://bulenox.com/accounts-pricing?risk=trailing#plans',
  }),
  ...table({
    firmId: 'bulenox', program: 'Option 2 · EOD', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1500, 2500, 3000, 4500], type: 'eod', lock: null,
    dll: [500, 1100, 2200, 3300], consistency: null, minDays: null, minis: [3, 7, 12, 15],
    notes: 'Qualification account. EOD drawdown; DLL disables trading for the day (not a violation). Dynamic scaling by cash on hand — starts at 2 / 2 / 3 / 5 contracts, max shown.',
    src: 'https://bulenox.com/help-center/qualification',
  }),
  ...table({
    firmId: 'bulenox', program: 'Option 2 · EOD', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1500, 2500, 3000, 4500], type: 'eod', lock: 100,
    dll: [500, 1100, 2200, 3300], consistency: 40, minDays: null, minis: [2, 2, 3, 5],
    notes: 'Master account. Threshold fixed at start + $100; DLL removed permanently at that point. Scaling: first tier contracts shown. Payouts: 10 trading days, 40% consistency, $1,000 minimum.',
    src: 'https://bulenox.com/help-center/qualification',
    verification: 'partial', unverified: 'Master drawdown amounts assumed equal to Qualification.',
  }),
  ...table({
    firmId: 'bulenox', program: 'Option 1 · Trailing', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1500, 2500, 3000, 4500], type: 'intraday', lock: 100,
    dll: NONE4, consistency: 40, minDays: null, minis: [3, 7, 12, 15],
    notes: 'Master account. Payouts: 10 trading days, 40% consistency, $1,000 minimum.',
    src: 'https://bulenox.com/help-center/master',
    verification: 'partial', unverified: 'Where the trailing drawdown stops on Option 1 Master (assumed start + $100, as stated for Option 2) and Master drawdown amounts.',
  }),
]

// ───────────────────────── Elite Trader Funding ─────────────────────────
const etf: PropPreset[] = [
  ...table({
    firmId: 'etf', program: '1 Step', phase: 'evaluation', sizes: K(50, 100, 250),
    target: [3000, 6000, 15000], dd: [2000, 3000, 6500], type: 'intraday', lock: null,
    dll: [null, null, null], consistency: null, minDays: 5, minis: [8, 14, 24],
    notes: 'Live trailing drawdown on open + realized profit. No DLL. Minimum 5 trading days (1 with add-on). Going over the contract cap fails the account. No 150K size on this plan.',
    src: 'https://elitetraderfunding.app/1-step-evaluation',
  }),
  ...table({
    firmId: 'etf', program: 'End of Day', phase: 'evaluation', sizes: K(50, 100),
    target: [3000, 6000], dd: [2000, 3500], type: 'eod', lock: null,
    dll: [1100, 2200], consistency: null, minDays: 5, minis: [8, 14],
    notes: 'EOD trailing on realized balance. DLL is a HARD breach (fails the account) unless TradeShield is added. No consistency rule. Minimum 5 days.',
    src: 'https://elitetraderfunding.app/end-of-day-evaluation',
  }),
  ...table({
    firmId: 'etf', program: 'Static', phase: 'evaluation', sizes: K(10, 25, 50),
    target: [1000, 2000, 4000], dd: [500, 1000, 2000], type: 'static', lock: null,
    dll: [null, null, null], consistency: null, minDays: 5,
    notes: 'Fixed minimum balance that never trails. No DLL, no consistency. Minimum 5 days. Flatten one minute before close.',
    src: 'https://elitetraderfunding.app/static-drawdown',
    verification: 'partial', unverified: 'Static plan contract caps (not listed on the plan page).',
  }),
]

// ───────────────────────── TradeDay ─────────────────────────
const TD = 'https://tradeday.freshdesk.com/en/support/solutions/articles/'
const tradeday: PropPreset[] = [
  ...table({
    firmId: 'tradeday', program: 'Quick Pay · Intraday', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4500], type: 'intraday', lock: 0,
    dll: NONE4, consistency: 30, minDays: 5, minis: [2, 5, 10, 15], micros: [20, 50, 50, 50],
    notes: 'Intraday trailing drawdown that stops at the starting balance. No day above 30% of total profit (target rises otherwise). Minimum 5 trading days. Micros capped at 50.',
    src: 'https://www.tradeday.com/',
  }),
  ...table({
    firmId: 'tradeday', program: 'Fast Pass · EOD', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1500, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4500], type: 'eod', lock: 0,
    dll: NONE4, consistency: 45, minDays: 3, minis: [2, 5, 10, 15], micros: [20, 50, 50, 50],
    notes: 'Same targets, limits and drawdown amounts as Quick Pay, calculated end-of-day. 45% consistency, minimum 3 days.',
    src: `${TD}103000008847-what-are-the-objectives-and-rules-of-the-quick-pay-and-fast-pass-evaluat`,
  }),
  ...table({
    firmId: 'tradeday', program: 'Quick Pay', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4500], type: 'intraday', lock: 0,
    dll: NONE4, consistency: null, minDays: null, minis: [2, 5, 10, 15], micros: [20, 50, 50, 50],
    notes: 'All Quick Pay funded sim accounts use an intraday drawdown regardless of the evaluation type. No trading within 2% of a price limit.',
    src: `${TD}103000008889-what-are-the-rules-for-funded-funded-sim-and-funded-live-`,
    verification: 'partial', unverified: 'Funded consistency/payout rules not covered here.',
  }),
  ...table({
    firmId: 'tradeday', program: 'Fast Pass', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4500], type: 'eod', lock: 0,
    dll: NONE4, consistency: null, minDays: null, minis: [2, 5, 10, 15], micros: [20, 50, 50, 50],
    notes: 'All Fast Pass funded sim accounts use an EOD drawdown.',
    src: `${TD}103000008889-what-are-the-rules-for-funded-funded-sim-and-funded-live-`,
    verification: 'partial', unverified: 'Funded consistency/payout rules not covered here.',
  }),
]

// ───────────────────────── Lucid Trading ─────────────────────────
const LUCID = 'https://support.lucidtrading.com/en/articles/'
const lucid: PropPreset[] = [
  ...table({
    firmId: 'lucid', program: 'LucidPro', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1250, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4500], type: 'eod', lock: 100,
    dll: [null, 1200, 1800, 2700], consistency: null, minDays: 1, minis: [2, 4, 6, 10],
    notes: 'EOD Max Loss Limit; locks at start + $100 once the balance passes the Initial Trail Balance. DLL is a soft breach and optional at purchase (25K has none). Pass in one day.',
    src: `${LUCID}12890029-lucidpro-evaluation-account`,
  }),
  ...table({
    firmId: 'lucid', program: 'LucidPro', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4500], type: 'eod', lock: 100,
    dll: [null, 1200, 1800, 2700], consistency: 40, minDays: null, minis: [2, 4, 6, 10],
    notes: 'Fixed DLL until the Initial Trail Balance, then LucidScale DLL = 60% of the highest EOD profit. 40% consistency for payouts (35% for accounts bought before 11/28/2025). No scaling plan.',
    src: `${LUCID}12890069-lucidpro-funded-account`,
  }),
  ...table({
    firmId: 'lucid', program: 'LucidFlex', phase: 'evaluation', sizes: K(25, 50, 100, 150),
    target: [1250, 3000, 6000, 9000], dd: [1000, 2000, 3000, 4500], type: 'eod', lock: null,
    dll: NONE4, consistency: 40, minDays: 3, minis: [2, 4, 6, 10],
    notes: '40% consistency (50% add-on → 2 days). DLL on/off chosen at checkout — enter yours if you picked it.',
    src: `${LUCID}12945790-lucidflex-evaluation-account`,
    verification: 'partial', unverified: 'Where the EOD drawdown locks (not stated on the evaluation page); DLL amount when enabled.',
  }),
  ...table({
    firmId: 'lucid', program: 'LucidFlex', phase: 'funded', sizes: K(25, 50, 100, 150),
    target: NONE4, dd: [1000, 2000, 3000, 4500], type: 'eod', lock: null,
    dll: NONE4, consistency: null, minDays: null, minis: [2, 4, 6, 10],
    notes: 'No consistency rule, no payout buffer, optional DLL, scaling plan applies (contracts shown are the max).',
    src: `${LUCID}12945795-lucidflex-funded-account`,
    verification: 'partial', unverified: 'Scaling-plan tiers and lock level.',
  }),
]

export const PROP_PRESETS: PropPreset[] = [...apex, ...topstep, ...tpt, ...mffu, ...tradeify, ...bulenox, ...etf, ...tradeday, ...lucid]
export const PRESET_BY_ID: Record<string, PropPreset> = Object.fromEntries(PROP_PRESETS.map((p) => [p.id, p]))

export function presetsFor(firmId: string): PropPreset[] {
  return PROP_PRESETS.filter((p) => p.firmId === firmId)
}

export const CUSTOM_RULES: PropRules = {
  profitTarget: 3000, maxDrawdown: 2000, drawdownType: 'eod', trailLockOffset: 0,
  dailyLossLimit: null, consistencyPct: null, minTradingDays: null, maxMinis: null, maxMicros: null, notes: '',
}

export const sizeLabel = (n: number) => (n >= 1000 ? `${n / 1000}K` : `$${n}`)
export const presetLabel = (p: PropPreset) =>
  `${FIRM_BY_ID[p.firmId]?.name ?? p.firmId} · ${p.program} · ${sizeLabel(p.size)} ${p.phase === 'evaluation' ? 'Evaluation' : 'Funded'}`
