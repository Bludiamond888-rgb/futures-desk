import { describe, expect, it } from 'vitest'
import { parseHash, routeHash } from './route'

describe('hash routes', () => {
  it('defaults to calculator', () => {
    expect(parseHash('')).toEqual({ tab: 'calculator', sub: 'trades', psub: 'accounts' })
    expect(parseHash('#/nope')).toEqual({ tab: 'calculator', sub: 'trades', psub: 'accounts' })
  })
  it('parses existing saved URLs', () => {
    expect(parseHash('#/journal/stats').sub).toBe('stats')
    expect(parseHash('#/journal/data').sub).toBe('data')
    expect(parseHash('#/prop/prices').psub).toBe('prices')
    expect(parseHash('#/contracts').tab).toBe('contracts')
    expect(parseHash('#journal').tab).toBe('journal')
  })
  it('round-trips', () => {
    for (const h of ['/calculator', '/contracts', '/journal', '/journal/stats', '/journal/data', '/prop', '/prop/prices']) {
      expect(routeHash(parseHash('#' + h))).toBe(h)
    }
  })
})
