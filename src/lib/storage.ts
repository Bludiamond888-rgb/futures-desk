import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { DEFAULT_STRATEGIES, type ContractSpec, type Trade } from '../data/types'
import { CONTRACTS } from '../data/contracts'
import type { PropAccount } from './prop'

export const STORAGE_KEYS = {
  customContracts: 'fta.customContracts.v1',
  calculator: 'fta.calculator.v1',
  calcSymbol: 'fta.calculator.symbol.v1',
  trades: 'fta.trades.v1',
  strategies: 'fta.strategies.v1',
  filters: 'fta.journal.filters.v1',
  propAccounts: 'fta.propAccounts.v1',
  calcProp: 'fta.calculator.prop.v1',
  propPrices: 'fta.propPrices.v1',
  propPriceSize: 'fta.propPrices.size.v1',
} as const

/** Browsers give an origin roughly 5 MB (≈5M UTF-16 chars) of localStorage. */
export const STORAGE_LIMIT_CHARS = 5_000_000
export const STORAGE_WARN_RATIO = 0.8

// ── tiny store for "last write failed" so any component can show a banner ──
let lastError: string | null = null
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; listeners.forEach((l) => l()) }
export function subscribeStorage(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function clearStorageError() { lastError = null; emit() }

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    if (lastError) lastError = null
    emit()
    return true
  } catch (e) {
    lastError = `Couldn't save to on-device storage (${(e as Error)?.name || 'error'}). Storage may be full — remove screenshots or export a backup.`
    emit()
    return false
  }
}

export function storageUsageChars(): number {
  let n = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      n += k.length + (localStorage.getItem(k)?.length ?? 0)
    }
  } catch { /* ignore */ }
  return n
}

export interface StorageHealth { used: number; limit: number; ratio: number; nearLimit: boolean; error: string | null }
export function getStorageHealth(): StorageHealth {
  const used = storageUsageChars()
  const ratio = used / STORAGE_LIMIT_CHARS
  return { used, limit: STORAGE_LIMIT_CHARS, ratio, nearLimit: ratio >= STORAGE_WARN_RATIO, error: lastError }
}

export function useStorageHealth(): StorageHealth {
  useSyncExternalStore(subscribeStorage, () => version)
  return getStorageHealth()
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readJSON(key, initial))
  useEffect(() => { writeJSON(key, value) }, [key, value])
  return [value, setValue] as const
}

/** Built-in + user custom contracts. */
export function useContracts() {
  const [custom, setCustom] = useLocalStorage<ContractSpec[]>(STORAGE_KEYS.customContracts, [])
  const all = [...CONTRACTS, ...custom]
  const addCustom = useCallback(
    (spec: ContractSpec) => setCustom((prev) => [...prev, { ...spec, custom: true, verified: false }]),
    [setCustom],
  )
  const removeCustom = useCallback(
    (symbol: string) => setCustom((prev) => prev.filter((x) => x.symbol !== symbol)),
    [setCustom],
  )
  return { all, custom, setCustom, addCustom, removeCustom }
}

export function useTrades() {
  const [trades, setTrades] = useLocalStorage<Trade[]>(STORAGE_KEYS.trades, [])
  const upsert = useCallback((t: Trade) => setTrades((prev) => {
    const i = prev.findIndex((x) => x.id === t.id)
    if (i < 0) return [...prev, t]
    const next = prev.slice(); next[i] = t; return next
  }), [setTrades])
  const remove = useCallback((id: string) => setTrades((prev) => prev.filter((t) => t.id !== id)), [setTrades])
  return { trades, setTrades, upsert, remove }
}

export function usePropAccounts() {
  const [accounts, setAccounts] = useLocalStorage<PropAccount[]>(STORAGE_KEYS.propAccounts, [])
  const upsertAccount = useCallback((a: PropAccount) => setAccounts((prev) => {
    const i = prev.findIndex((x) => x.id === a.id)
    if (i < 0) return [...prev, a]
    const next = prev.slice(); next[i] = a; return next
  }), [setAccounts])
  const removeAccount = useCallback((id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id)), [setAccounts])
  return { accounts, setAccounts, upsertAccount, removeAccount }
}

export function useStrategies() {
  const [strategies, setStrategies] = useLocalStorage<string[]>(STORAGE_KEYS.strategies, DEFAULT_STRATEGIES)
  return { strategies, setStrategies }
}

export const formatBytesish = (chars: number) =>
  chars < 1e6 ? `${(chars / 1e3).toFixed(0)} KB` : `${(chars / 1e6).toFixed(2)} MB`
