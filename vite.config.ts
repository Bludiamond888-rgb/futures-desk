/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const PUBLIC = path.resolve(import.meta.dirname, 'public')

function listPublic(dir = PUBLIC, base = ''): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    const rel = base ? `${base}/${f}` : f
    return statSync(p).isDirectory() ? listPublic(p, rel) : [rel]
  })
}

/** Emits sw.js with a precache list of every built asset + public file (offline-first PWA). */
function serviceWorker(): Plugin {
  return {
    name: 'futures-desk-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = [
        './',
        './index.html',
        ...Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map')).map((f) => `./${f}`),
        ...listPublic().filter((f) => !f.startsWith('.')).map((f) => `./${f}`),
      ]
      const hash = createHash('sha256')
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name)
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source))
      }
      const version = hash.digest('hex').slice(0, 12)
      const tpl = readFileSync(path.resolve(import.meta.dirname, 'src/sw-template.js'), 'utf8')
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify([...new Set(files)], null, 2)),
      })
    },
  }
}

/** Single-file build: drop the manifest link and inline the icons as data URIs. */
function singleHtml(): Plugin {
  const b64 = (f: string) => `data:image/png;base64,${readFileSync(path.join(PUBLIC, f)).toString('base64')}`
  return {
    name: 'futures-desk-single-html',
    transformIndexHtml(html) {
      return html
        .replace(/\s*<link rel="manifest"[^>]*>/, '')
        .replace(/href="\.\/icons\/apple-touch-icon\.png"/, `href="${b64('icons/apple-touch-icon.png')}"`)
        .replace(/href="\.\/icons\/favicon-32\.png"/, `href="${b64('icons/favicon-32.png')}"`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [react(), ...(single ? [singleHtml(), viteSingleFile()] : [serviceWorker()])],
    publicDir: single ? false : 'public',
    build: { outDir: single ? 'dist-single' : 'dist', emptyOutDir: true },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
