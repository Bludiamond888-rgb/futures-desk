// WebKit iPhone screenshots of the TP/SL calculator. Usage: npm run build && node scripts/screens-tpsl.mjs
import { webkit, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { server, url } = await serve(path.join(root, 'dist'))
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], serviceWorkers: 'block' })
const p = await ctx.newPage()
const out = (n) => path.join(root, 'screens', n)
const exp = async (sel, v) => { const t = (await p.textContent(sel)).trim(); if (t !== v) throw new Error(`${sel}: ${t} != ${v}`) }
await p.goto(url + '#/calculator'); await p.evaluate(() => localStorage.clear()); await p.reload()
await p.waitForSelector('#tp')
await exp('[data-testid=tp-value]', '—'); await exp('[data-testid=rr]', '—')
await p.screenshot({ path: out('tpsl-1-empty-iphone.png') })
await p.click('.picker-control'); await p.fill('.picker-input', 'ES'); await p.keyboard.press('Enter')
await p.fill('#qty', '2'); await p.fill('#tp', '10'); await p.fill('#sl', '5')
await exp('[data-testid=tp-value]', '+$1,000.00'); await exp('[data-testid=sl-value]', '−$500.00')
await exp('[data-testid=rr]', '2.00 : 1'); await exp('[data-testid=bewr]', '33.3%')
await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: out('tpsl-2-es-filled-iphone.png') })
await p.fill('#entry', '5000'); await p.click('.seg.side button:has-text("Long")')
await exp('[data-testid=tp-price]', '@ 5,010.00'); await exp('[data-testid=sl-price]', '@ 4,995.00')
await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: out('tpsl-3-entry-long-iphone.png') })
await p.click('.seg.side button:has-text("Short")')
await exp('[data-testid=tp-price]', '@ 4,990.00'); await exp('[data-testid=sl-price]', '@ 5,005.00')
await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: out('tpsl-4-entry-short-iphone.png') })
await p.screenshot({ path: out('tpsl-4-entry-short-iphone-full.png'), fullPage: true })
await p.reload(); await p.waitForSelector('#tp'); if (await p.inputValue('#tp') !== '10') throw new Error('not persisted')
console.log('ok'); await b.close(); server.close()
