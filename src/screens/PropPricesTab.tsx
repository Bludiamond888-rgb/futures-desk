import { SEED_PRICES } from '../data/propPricesSeed'
import type { PriceEntry } from '../lib/propPrices'
import { STORAGE_KEYS, useLocalStorage } from '../lib/storage'
import { PropPrices } from './PropPrices'

/** Owns the prices state so the 35 KB seed list only loads with this tab. */
export default function PropPricesTab() {
  const [prices, setPrices] = useLocalStorage<PriceEntry[]>(STORAGE_KEYS.propPrices, SEED_PRICES)
  const [size, setSize] = useLocalStorage<number>(STORAGE_KEYS.propPriceSize, 50_000)
  return (
    <section className="screen prop-prices">
      <h2 className="screen-title">Prop firm prices</h2>
      <PropPrices prices={prices} setPrices={setPrices} size={size} setSize={setSize} />
    </section>
  )
}
