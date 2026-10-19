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
