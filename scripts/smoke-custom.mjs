// Smoke test: add a custom contract, check persistence and that it opens in the calculator.
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = pathToFileURL(path.join(root, 'dist-single/index.html')).href
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto(url + '#/contracts'); await p.evaluate(() => localStorage.clear()); await p.reload()
await p.click('text=+ Add custom contract')
const inputs = p.locator('.custom-form input')
await inputs.nth(0).fill('FTSEX'); await inputs.nth(1).fill('Test FTSE'); await inputs.nth(2).fill('ICE Europe')
await inputs.nth(3).fill('0.5'); await inputs.nth(4).fill('5')
await p.selectOption('.custom-form select >> nth=1', 'GBP')
console.log('preview:', await p.textContent('.pv b'))
await p.screenshot({ path: path.join(root, 'screens/extra-custom-form.png') })
await p.click('text=Save contract')
await p.reload()
const card = p.locator('.card', { hasText: 'FTSEX' })
console.log('card persisted:', await card.count())
await card.locator('text=Open in calculator').click()
await p.fill('#qty', '2'); await p.fill('#move', '10')
console.log('2 FTSEX x 10 pts =', await p.textContent('[data-testid=value]'))
await b.close()
