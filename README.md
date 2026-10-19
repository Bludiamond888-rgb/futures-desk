# Futures Desk

React + TypeScript + Vite. Dark trader-style UI. All data stays on the device (localStorage).

Sections: **Calculator**, **Contracts** (83 verified specs + custom), **Journal** (Trades · Stats · Data).

## Builds
`npm run build` produces both outputs:

| Output | What it is |
|---|---|
| `dist/` | Deployable static PWA (manifest, icons, `sw.js` offline cache, relative paths). Upload the folder to GitHub Pages / Netlify / any static host. |
| `dist-single/index.html` | One self-contained offline HTML file (no service worker, no manifest; icons inlined). Open from anywhere, including `file://`. |

Separately: `npm run build:pwa`, `npm run build:single`.

### Deploying (not done automatically)
- **Netlify:** drag-and-drop `dist/` or set publish dir = `dist`, build = `npm run build`.
- **GitHub Pages:** publish the contents of `dist/` (includes `.nojekyll`). Relative base `./` works from a sub-path such as `/<repo>/`.
- iPhone install: open the hosted URL in Safari → Share → Add to Home Screen. A service worker needs HTTPS (both hosts provide it).

## Tests
- `npm test`: vitest unit tests (calc engine, spec sanity, P&L, stats, CSV round trip, JSON backup)
- `npm run test:e2e`: Playwright smoke test (adds 3 trades, reloads, checks stats/filters/duplicate/delete, CSV + JSON round trips, screenshot attach, storage warning, SW offline, single-file build)
- `npm run smoke`: both browser smoke tests
- `npm run screens`: regenerate screenshots into `screens/` (loads SAMPLE data, then clears it)
- Icons: `python3 scripts/make-icons.py` (Pillow)

Browser scripts use system Chrome (`PW_CHANNEL=chrome`); set `PW_CHANNEL=` to another channel if needed.

## Data
localStorage keys: `fta.trades.v1`, `fta.strategies.v1`, `fta.customContracts.v1`, `fta.journal.filters.v1`,
`fta.calculator.v1`, `fta.calculator.symbol.v1`.

- Each trade stores a snapshot of tickSize / tickValue / currency, so P&L survives later spec edits or deleted custom contracts.
- Fees = total round-trip commissions and fees for the trade, in the contract currency. Net = gross − fees.
- Stats are computed per currency (USD, EUR…) and are never converted or combined.
- CSV: RFC 4180, UTF-8 with BOM. It round-trips every field except screenshots. Computed columns (points, ticks, grossPnl, netPnl) are export-only.
- JSON backup: trades (with screenshots), custom contracts and strategies. Restoring replaces current data.
- Sample data: Journal → Data → "Load sample data" (off by default, every trade is marked Sample).
