// WebKit iPhone screenshots of Prop → Prices. Uses the real seeded data (scouting scan 2026-10-18).
// If the list is ever empty, two clearly labelled SAMPLE entries are injected here only (never in the app).
import { webkit, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = pathToFileURL(path.resolve(root, 'dist-single', 'index.html')).href
const out = (n) => path.join(root, 'screens', n)
const browser = await webkit.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' })
const page = await ctx.newPage()
let errors = 0
page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message) })
await page.goto(url + '#/prop/prices')
await page.evaluate(() => localStorage.clear()); await page.reload()
if ((await page.locator('[data-testid=price-card]').count()) === 0) {
  await page.evaluate(() => localStorage.setItem('fta.propPrices.v1', JSON.stringify([
    { id: 's1', firm: 'SAMPLE Firm A', size: 50000, evalFee: 100, billing: 'monthly', activationFee: 0, otherFees: 0, promoCode: 'SAMPLE', discountPct: 50, notes: 'Sample entry — not a real price', url: '', lastChecked: '2026-10-21', sample: true },
    { id: 's2', firm: 'SAMPLE Firm B', size: 50000, evalFee: 80, billing: 'one-time', activationFee: 20, otherFees: 0, promoCode: '', discountPct: 0, notes: 'Sample entry — not a real price', url: '', lastChecked: '2026-10-21', sample: true },
  ])))
  await page.reload()
}
const shot = async (n, full = false) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); await page.screenshot({ path: out(n), fullPage: full }); console.log('wrote', n) }
await page.waitForSelector('[data-testid=price-card]')
const first = await page.locator('[data-testid=price-card]').first()
console.log('50K best:', (await first.locator('.pp-title h3').textContent()), (await first.locator('.pp-total b').textContent()), 'badge:', await first.locator('.best-badge').count())
await shot('prop-prices-50k-iphone.png')
await page.click('.pp-sizes button:has-text("150K")')
await page.waitForSelector('[data-testid=price-card]')
console.log('150K best:', await page.locator('[data-testid=price-card] .pp-title h3').first().textContent(), await page.locator('[data-testid=price-card] .pp-total b').first().textContent())
await shot('prop-prices-150k-iphone.png')
await page.click('.pp-sizes button:has-text("25K")'); await shot('prop-prices-empty-25k-iphone.png')
await page.click('.pp-sizes button:has-text("50K")')
await page.locator('[data-testid=price-card]').nth(1).locator('button[aria-label="Edit price"]').click()
await page.waitForSelector('.modal'); await page.screenshot({ path: out('prop-prices-edit-form-iphone.png') }); console.log('wrote prop-prices-edit-form-iphone.png')
const scrollW = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
console.log('no horizontal scroll:', scrollW, 'page errors:', errors)
await browser.close()
if (!scrollW || errors) process.exit(1)
