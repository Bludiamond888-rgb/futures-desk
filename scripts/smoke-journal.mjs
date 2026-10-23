// Browser smoke test for phase 2 (run after `npm run build`):
//  - PWA build over http: add 3 trades, reload, check stats, filters, duplicate/delete,
//    CSV export→import round trip, JSON backup→restore, service worker offline load.
//  - Single-file build over file://: add a trade, reload, check it persisted.
//  - Phase 3: prop account create/edit, bulk-assign, linked trade, dashboard values, calculator
//    prop warning + over-max, backup v2 with accounts, sample load/remove, account delete unlinks.
import { chromium } from 'playwright'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { serve } from './serve.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const check = (name, actual, expected) => {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
}
const norm = (s) => (s ?? '').replace(/\u2212/g, '-').trim()

async function addTrade(page, t) {
  await page.click('text=+ New trade')
  await page.waitForSelector('.modal .trade-form')
  await page.click('.modal .picker-control')
  await page.fill('.modal .picker-input', t.symbol)
  await page.keyboard.press('Enter')
  await page.fill('.modal input[name=datetime]', t.datetime)
  await page.click(`.modal .seg.side button:has-text("${t.side === 'long' ? 'Long' : 'Short'}")`)
  await page.fill('.modal input[name=entry]', t.entry)
  await page.fill('.modal input[name=exit]', t.exit)
  await page.fill('.modal input[name=qty]', t.qty)
  if (t.stop) await page.fill('.modal input[name=stop]', t.stop)
  await page.fill('.modal input[name=fees]', t.fees)
  await page.selectOption('.modal select[name=strategy]', t.strategy)
  await page.fill('.modal textarea[name=notes]', t.notes ?? '')
  if (t.account) await page.selectOption('.modal select[name=accountId]', t.account)
  const net = norm(await page.textContent('[data-testid=form-net]'))
  await page.click('.modal-foot button:has-text("Save trade")')
  await page.waitForSelector('.modal', { state: 'detached' })
  return net
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' })

// ───────── PWA build over HTTP ─────────
const { server, url } = await serve(path.resolve(root, process.env.DIST_DIR || 'dist'))
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, timezoneId: 'America/New_York' })
const page = await ctx.newPage()
page.on('pageerror', (e) => { failures++; console.log('PAGE ERROR', e.message) })
await page.goto(url + '#/journal')
await page.evaluate(() => localStorage.clear())
await page.reload()

check('form net MNQ', await addTrade(page, { symbol: 'MNQ', datetime: '2026-10-14T09:35', side: 'long', entry: '20000', exit: '20010', qty: '5', fees: '3.70', strategy: 'ORB', stop: '19995', notes: 'smoke, "quoted"\nline2' }), '$96.30')
check('form net ES', await addTrade(page, { symbol: 'ES', datetime: '2026-10-15T10:00', side: 'short', entry: '5850', exit: '5845.5', qty: '2', fees: '9', strategy: 'Breakout' }), '$441.00')
check('form net FDAX', await addTrade(page, { symbol: 'FDAX', datetime: '2026-10-16T03:30', side: 'long', entry: '19400', exit: '19390', qty: '1', fees: '4', strategy: 'Pullback' }), '-€254.00')

await page.reload()
await page.waitForSelector('table.trades tbody tr', { state: 'attached' })
check('rows after reload', await page.locator('table.trades tbody tr').count(), 3)
await page.click('.subtabs button:has-text("Stats")')
check('USD net', norm(await page.textContent('[data-testid=net-USD]')), '$537.30')
check('USD count', norm(await page.textContent('[data-testid=count-USD]')), '2')
check('USD win rate', norm(await page.textContent('[data-testid=winrate-USD]')), '100.0%')
check('USD profit factor', norm(await page.textContent('[data-testid=pf-USD]')), '∞')
check('EUR net (separate)', norm(await page.textContent('[data-testid=net-EUR]')), '-€254.00')
check('EUR win rate', norm(await page.textContent('[data-testid=winrate-EUR]')), '0.0%')
check('equity charts', await page.locator('.equity svg').count(), 2)

// filters respected by stats
await page.selectOption('select[aria-label="Filter by strategy"]', 'ORB')
check('filtered USD net', norm(await page.textContent('[data-testid=net-USD]')), '$96.30')
check('EUR hidden by filter', await page.locator('[data-testid=net-EUR]').count(), 0)
await page.click('.filters button:has-text("Clear")')
await page.fill('.filters input[type=date] >> nth=0', '2026-10-15')
check('date filter USD count', norm(await page.textContent('[data-testid=count-USD]')), '1')
await page.click('.filters button:has-text("Clear")')

// duplicate + delete (with confirm)
await page.click('.subtabs button:has-text("Trades")')
await page.locator('table.trades tbody tr', { hasText: 'FDAX' }).locator('button[aria-label=Duplicate]').click()
await page.click('.modal-foot button:has-text("Save trade")')
check('rows after duplicate', await page.locator('table.trades tbody tr').count(), 4)
await page.locator('table.trades tbody tr', { hasText: 'FDAX' }).first().locator('button[aria-label=Delete]').click()
await page.click('.modal-foot button:has-text("Cancel")')
check('cancel keeps row', await page.locator('table.trades tbody tr').count(), 4)
await page.locator('table.trades tbody tr', { hasText: 'FDAX' }).first().locator('button[aria-label=Delete]').click()
await page.click('[data-testid=confirm]')
check('rows after delete', await page.locator('table.trades tbody tr').count(), 3)

// sorting by net
await page.click('th button:has-text("Net P&L")')
const firstNet = norm(await page.textContent('table.trades tbody tr:first-child td:nth-child(9)'))
check('sort by net desc → top row', firstNet, '$441.00')

// CSV export → wipe → import
await page.click('.subtabs button:has-text("Data")')
const before = await page.evaluate(() => localStorage.getItem('fta.trades.v1'))
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export CSV")')])
const csvPath = path.join(root, 'screens', '.smoke-export.csv')
await dl.saveAs(csvPath)
await page.click('button:has-text("Delete all trades")'); await page.click('[data-testid=confirm]')
check('wiped', await page.evaluate(() => JSON.parse(localStorage.getItem('fta.trades.v1')).length), 0)
await page.setInputFiles('[data-testid=csv-input]', csvPath)
await page.waitForSelector('.toast.ok')
const after = await page.evaluate(() => localStorage.getItem('fta.trades.v1'))
const sortById = (s) => JSON.stringify(JSON.parse(s).sort((a, b) => a.id.localeCompare(b.id)))
check('CSV round trip identical', sortById(after) === sortById(before), true)

// JSON backup → custom strategy change → restore
await page.evaluate(() => localStorage.setItem('fta.strategies.v1', JSON.stringify(['ORB', 'VWAP bounce', 'Breakout', 'Pullback', 'Reversal', 'Smoke strat'])))
await page.reload()
const [bk] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download backup")')])
const bkPath = path.join(root, 'screens', '.smoke-backup.json')
await bk.saveAs(bkPath)
const bkJson = JSON.parse(await readFile(bkPath, 'utf8'))
check('backup has trades', bkJson.trades.length, 3)
check('backup has strategies', bkJson.strategies.includes('Smoke strat'), true)
await page.click('button:has-text("Delete all trades")'); await page.click('[data-testid=confirm]')
await page.setInputFiles('[data-testid=json-input]', bkPath)
await page.click('[data-testid=confirm]')
await page.reload()
check('restored trades', await page.evaluate(() => JSON.parse(localStorage.getItem('fta.trades.v1')).length), 3)

// Screenshot attachment (compressed JPEG data URL) + storage-near-limit warning
await page.click('.subtabs button:has-text("Trades")')
await page.locator('table.trades tbody tr', { hasText: 'MNQ' }).locator('button[aria-label=Edit]').click()
await page.setInputFiles('.modal input[type=file]', path.join(root, 'public/icons/icon-512.png'))
await page.waitForSelector('.modal .shot-thumb')
await page.click('.modal-foot button:has-text("Save changes")')
check('screenshot stored as JPEG data URL', await page.evaluate(() => JSON.parse(localStorage.getItem('fta.trades.v1')).find((t) => t.symbol === 'MNQ').screenshot.startsWith('data:image/jpeg')), true)
check('screenshot button shown', await page.locator('table.trades button[aria-label="View screenshot"]').count(), 1)
await page.evaluate(() => localStorage.setItem('zz.filler', 'x'.repeat(4_200_000)))
await page.reload()
check('near-limit warning banner', await page.locator('.banner.warn').count(), 1)
await page.evaluate(() => localStorage.removeItem('zz.filler'))

// ───────── Phase 3: prop-firm tracker ─────────
const savedTrades = await page.evaluate(() => localStorage.getItem('fta.trades.v1'))
const ws = (x) => norm(x).replace(/\s+/g, ' ')
await page.goto(url + '#/calculator')
check('calc: prop panel hidden without accounts', await page.locator('[data-testid=calc-prop]').count(), 0)
await page.goto(url + '#/prop')
await page.waitForSelector('text=No prop accounts yet')
check('prop: empty state', await page.locator('text=No prop accounts yet').count(), 1)
await page.click('button:has-text("+ New account")')
await page.selectOption('.modal select[name=firm]', 'topstep')
check('prop: preset target', await page.inputValue('.modal input[name=profitTarget]'), '3000')
check('prop: preset drawdown', await page.inputValue('.modal input[name=maxDrawdown]'), '2000')
check('prop: preset lock at start', await page.inputValue('.modal input[name=trailLockOffset]'), '0')
check('prop: preset source link', await page.locator('.modal .src-note a').getAttribute('href'), 'https://help.topstep.com/en/articles/8284197-trading-combine-parameters')
await page.selectOption('.modal select[name=sizeSel]', '150000')
check('prop: 150K drawdown', await page.inputValue('.modal input[name=maxDrawdown]'), '4500')
await page.selectOption('.modal select[name=sizeSel]', '50000')
await page.fill('.modal input[name=name]', 'Smoke TS 50K')
await page.fill('.modal input[name=startDate]', '2026-10-01')
await page.fill('.modal input[name=dailyLossLimit]', '1000')
check('prop: edited badge', await page.locator('.modal .form-sub .badge').count(), 1)
await page.click('.modal-foot button:has-text("Create account")')
await page.waitForSelector('.pcard')
check('prop: card created', await page.locator('.pcard').count(), 1)
check('prop: starting balance', norm(await page.textContent('[data-testid=balance]')), '$50,000.00')
check('prop: rules disclaimer', (await page.textContent('.pcard .pc-foot')).includes('Rules change often — confirm with your firm.'), true)
const acctId = await page.evaluate(() => JSON.parse(localStorage.getItem('fta.propAccounts.v1'))[0].id)

// bulk-assign existing trades
await page.goto(url + '#/journal')
await page.click('[data-testid=select-all]')
check('bulk: bar shown', await page.locator('[data-testid=bulk-bar]').count(), 1)
await page.selectOption('[data-testid=bulk-bar] select', acctId)
await page.click('[data-testid=bulk-apply]')
check('bulk: 3 trades linked', await page.evaluate((id) => JSON.parse(localStorage.getItem('fta.trades.v1')).filter((t) => t.accountId === id).length, acctId), 3)
await page.selectOption('select[aria-label="Filter by prop account"]', 'none')
check('filter: unassigned → none', await page.locator('table.trades tbody tr').count(), 0)
await page.selectOption('select[aria-label="Filter by prop account"]', '')

// a losing trade today via the trade-form account picker
const nowStr = await page.evaluate(() => { const d = new Date(Date.now() - 10 * 60000); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` })
check('form: linked trade net', await addTrade(page, { symbol: 'ES', datetime: nowStr, side: 'long', entry: '5850', exit: '5842.5', qty: '2', fees: '9', strategy: 'ORB', account: acctId }), '-$759.00')
await page.goto(url + '#/prop'); await page.waitForSelector('.pcard')
check('prop: balance net of fees', norm(await page.textContent('[data-testid=balance]')), '$49,778.30')
check('prop: DD room (EOD from closes)', ws(await page.textContent('[data-testid=dd-room] .g-head b')), '$1,241.00')
check('prop: DLL room', ws(await page.textContent('[data-testid=dll-room] .g-head b')), '$241.00')
check('prop: warning status', norm(await page.textContent('.pcard [data-testid=health]')), 'Warning')
check('prop: non-USD excluded note', (await page.textContent('.pcard .pc-foot')).includes('non-USD'), true)
await page.reload(); await page.waitForSelector('.pcard')
check('prop: persisted after reload', norm(await page.textContent('[data-testid=balance]')), '$49,778.30')

// calculator integration
await page.goto(url + '#/calculator')
await page.waitForSelector('[data-testid=calc-prop]')
check('calc: prop panel shown', await page.locator('[data-testid=calc-prop]').count(), 1)
check('calc: collapsed by default', await page.locator('.pp-body').count(), 0)
await page.click('.pp-toggle')
await page.selectOption('#pp-acct', acctId)
await page.click('.picker-control'); await page.fill('.picker-input', 'ES'); await page.keyboard.press('Enter')
await page.fill('#qty', '1'); await page.fill('#pp-stop', '4')
check('calc: risk sentence', ws(await page.textContent('[data-testid=prop-risk] p')), 'This risks $200.00, which leaves $1,041.00 before your drawdown limit and $41.00 before today’s daily loss limit.')
check('calc: no warning when inside', await page.locator('[data-testid=prop-risk] .pp-warn').count(), 0)
check('calc: max contracts by room', norm(await page.textContent('[data-testid=max-by-room]')), '1')
await page.fill('#pp-stop', '5')
check('calc: red breach warning', await page.locator('[data-testid=prop-risk].bad .pp-warn').count(), 1)
check('calc: max contracts by room = 0', norm(await page.textContent('[data-testid=max-by-room]')), '0')
await page.fill('#pp-stop', '1'); await page.fill('#qty', '6')
check('calc: over account max warning', (await page.textContent('[data-testid=over-max]')).includes('max of 5 minis'), true)
await page.click('.picker-control'); await page.fill('.picker-input', 'MES'); await page.keyboard.press('Enter')
check('calc: micros use micro limit', await page.locator('[data-testid=over-max]').count(), 0)

// backup carries prop accounts
await page.goto(url + '#/journal/data')
const [pb] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download backup")')])
const pbPath = path.join(root, 'screens', '.smoke-backup-prop.json')
await pb.saveAs(pbPath)
const pbJson = JSON.parse(await readFile(pbPath, 'utf8'))
check('backup v2', pbJson.version, 2)
check('backup has prop accounts', pbJson.propAccounts.length, 1)
await page.evaluate(() => localStorage.setItem('fta.propAccounts.v1', '[]')); await page.reload()
await page.setInputFiles('[data-testid=json-input]', pbPath)
await page.click('[data-testid=confirm]')
check('restore brings accounts back', await page.evaluate(() => JSON.parse(localStorage.getItem('fta.propAccounts.v1')).length), 1)
// sample data adds SAMPLE accounts and removes them again
await page.click('button:has-text("Load sample data")')
check('sample: 4 SAMPLE accounts added', await page.evaluate(() => JSON.parse(localStorage.getItem('fta.propAccounts.v1')).filter((a) => a.sample && a.name.startsWith('SAMPLE')).length), 4)
await page.click('button:has-text("Remove sample data")')
check('sample: removed, own account kept', await page.evaluate(() => JSON.parse(localStorage.getItem('fta.propAccounts.v1')).length), 1)
// delete account → trades unlinked, not deleted
await page.goto(url + '#/prop'); await page.click('.pcard button[aria-label="Delete account"]'); await page.click('[data-testid=confirm]')
check('delete account: trades kept + unlinked', await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('fta.trades.v1')); return `${t.length}/${t.filter((x) => x.accountId).length}` }), '4/0')
await page.evaluate((t) => { localStorage.setItem('fta.trades.v1', t); localStorage.removeItem('fta.propAccounts.v1'); localStorage.removeItem('fta.calculator.prop.v1') }, savedTrades)

// Service worker + offline
await page.goto(url + '#/calculator')
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload()
check('SW controls page', await page.evaluate(() => !!navigator.serviceWorker.controller), true)
await ctx.setOffline(true)
await page.reload()
check('offline: calculator renders', (await page.locator('.tpsl').count()) > 0, true)
await page.goto(url + '#/journal/stats')
check('offline: stats render', norm(await page.textContent('[data-testid=net-USD]')), '$537.30')
await ctx.setOffline(false)
const manifest = await (await page.request.get(url + 'manifest.webmanifest')).json()
check('manifest name', manifest.name, 'Futures Calc')
check('apple-touch-icon served', (await page.request.get(url + 'icons/apple-touch-icon.png')).status(), 200)
await ctx.close()
server.close()

// ───────── Single-file build over file:// ─────────
const single = pathToFileURL(path.resolve(root, process.env.SINGLE_DIR || 'dist-single', 'index.html')).href
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
p2.on('pageerror', (e) => { failures++; console.log('PAGE ERROR (single)', e.message) })
await p2.goto(single + '#/journal')
await p2.evaluate(() => localStorage.clear()); await p2.reload()
check('single: form net ZN', await addTrade(p2, { symbol: 'ZN', datetime: '2026-10-16T14:20', side: 'short', entry: '110-16', exit: '110-13', qty: '2', fees: '4.40', strategy: 'Breakout' }), '$183.10')
await p2.reload()
check('single: card after reload', await p2.locator('.tcard').count(), 1)
check('single: price shown in 32nds', (await p2.textContent('.tcard .tc-mid')).includes('110-16 → 110-13'), true)
check('single: no SW on file://', await p2.evaluate(() => !!navigator.serviceWorker?.controller), false)
await p2.evaluate(() => localStorage.clear())

await browser.close()
console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll smoke checks passed')
process.exit(failures ? 1 : 0)
