import type { ContractSpec, Trade } from '../data/types'
import type { PropAccount } from './prop'

export const BACKUP_APP = 'futures-desk'
/** v2 adds propAccounts. v1 files still restore (no prop accounts). */
export const BACKUP_VERSION = 2

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  trades: Trade[]
  customContracts: ContractSpec[]
  strategies: string[]
  propAccounts: PropAccount[]
}

export function makeBackup(data: { trades: Trade[]; customContracts: ContractSpec[]; strategies: string[]; propAccounts: PropAccount[] }): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...data }
}

export function parseBackup(text: string): Backup {
  let o: unknown
  try { o = JSON.parse(text) } catch { throw new Error('Not valid JSON') }
  const b = o as Partial<Backup>
  if (!b || b.app !== BACKUP_APP) throw new Error('Not a Futures Desk backup file')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new Error('Unsupported backup version')
  if (!Array.isArray(b.trades) || !Array.isArray(b.customContracts) || !Array.isArray(b.strategies)) {
    throw new Error('Backup is missing trades, customContracts or strategies')
  }
  if (b.propAccounts == null) b.propAccounts = []
  if (!Array.isArray(b.propAccounts)) throw new Error('Backup has an invalid propAccounts list')
  for (const a of b.propAccounts) {
    if (!a || typeof a.id !== 'string' || !Number.isFinite(a.startingBalance) || !a.rules || !(a.rules.maxDrawdown >= 0)) {
      throw new Error('Backup contains an invalid prop account')
    }
  }
  for (const t of b.trades) {
    if (!t || typeof t.id !== 'string' || typeof t.symbol !== 'string' || !(t.tickSize > 0) || !(t.tickValue > 0)) {
      throw new Error('Backup contains an invalid trade')
    }
  }
  return b as Backup
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
