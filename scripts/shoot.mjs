// Phase 7 visual sweep: screenshots, console errors and horizontal overflow per viewport.
// Usage: node scripts/shoot.mjs [baseUrl] [outDir]
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

// require() honours NODE_PATH, where cloud containers keep their pre-installed Playwright.
const { chromium } = createRequire(import.meta.url)('playwright')

const base = process.argv[2] ?? 'http://localhost:4173'
const out = process.argv[3] ?? '.playwright-mcp/shots'
mkdirSync(out, { recursive: true })

const pages = (process.env.PAGES ?? '/,/?q=hop chat,/tu/aromatic-compound,/tu/molecular-formula,/bai/11,/bai/12').split(',')
const viewports = [
  { name: '1440', width: 1440, height: 900, dpr: 2 },
  { name: '768', width: 768, height: 1024, dpr: 2 },
  { name: '390', width: 390, height: 844, dpr: 3 },
]
const schemes = (process.env.SCHEMES ?? 'light').split(',')

const browser = await chromium.launch()
let failures = 0
for (const scheme of schemes) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      colorScheme: scheme,
      reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference',
      javaScriptEnabled: !process.env.NOJS,
    })
    for (const path of pages) {
      const page = await context.newPage()
      const errors = []
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
      page.on('pageerror', (err) => errors.push(String(err)))
      page.on('response', (res) => res.status() >= 400 && errors.push(`${res.status()} ${res.url()}`))
      await page.goto(base + path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(process.env.NOJS ? 300 : 2200)
      // Walk the page so once-only scroll reveals fire before the full-page capture.
      if (!process.env.NOJS) await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        await new Promise((r) => setTimeout(r, 1200))
        window.scrollTo(0, 0)
      })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const slug = path === '/' ? 'home' : path.replace(/^\/\??/, '').replace(/[^a-z0-9]+/gi, '-')
      await page.screenshot({ path: `${out}/${scheme}-${vp.name}-${slug}.png`, fullPage: true })
      const bad = overflow > 0 || errors.length
      if (bad) failures++
      console.log(`${bad ? 'FAIL' : 'ok  '} ${scheme} ${vp.name} ${path} overflow=${overflow} errors=${errors.length}${errors.length ? ' ' + errors.join(' | ') : ''}`)
      await page.close()
    }
    await context.close()
  }
}
await browser.close()
process.exit(failures ? 1 : 0)
