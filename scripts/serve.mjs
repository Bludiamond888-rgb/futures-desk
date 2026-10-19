// Minimal static file server for tests (serves ./dist by default). Not used for deployment.
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' }

export function serve(dir, port = 0) {
  const root = path.resolve(dir)
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(root, p)
    if (!file.startsWith(root)) { res.writeHead(403).end(); return }
    try {
      if (!(await stat(file)).isFile()) throw new Error()
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(await readFile(file))
    } catch { res.writeHead(404).end('not found') }
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await serve(process.argv[2] ?? 'dist', Number(process.argv[3] ?? 4173))
  console.log('Serving', url)
}
