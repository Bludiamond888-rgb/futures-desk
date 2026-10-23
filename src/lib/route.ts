export type Tab = 'calculator' | 'contracts' | 'journal' | 'prop'
export type JournalSub = 'trades' | 'stats' | 'data'
export type PropSub = 'accounts' | 'prices'
export interface Route { tab: Tab; sub: JournalSub; psub: PropSub }

export const TAB_IDS: Tab[] = ['calculator', 'contracts', 'journal', 'prop']
const SUBS: JournalSub[] = ['trades', 'stats', 'data']

/** Hash routes are part of the saved-URL contract: #/calculator, #/journal/stats, #/prop/prices … */
export function parseHash(hash: string): Route {
  const [a, b] = hash.replace(/^#\/?/, '').split('/')
  const tab = TAB_IDS.includes(a as Tab) ? (a as Tab) : 'calculator'
  const sub = tab === 'journal' && SUBS.includes(b as JournalSub) ? (b as JournalSub) : 'trades'
  const psub: PropSub = tab === 'prop' && b === 'prices' ? 'prices' : 'accounts'
  return { tab, sub, psub }
}
export function routeHash({ tab, sub, psub }: Route): string {
  return tab === 'journal' && sub !== 'trades' ? `/journal/${sub}` : tab === 'prop' && psub === 'prices' ? '/prop/prices' : `/${tab}`
}
