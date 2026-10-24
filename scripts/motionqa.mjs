// Phase 7 gates on the production build: DPR-2 frame budget, Web Vitals, token contrast,
// keyboard focus order, reduced motion. Usage: node scripts/motionqa.mjs [baseUrl]
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)('playwright')
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch()
const results = []
const check = (name, pass, detail) => results.push({ name, pass, detail })

// 1. Frame budget at 1440×900 @2x while scrolling the whole home page, plus LCP and CLS.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => {
    window.__vitals = { lcp: 0, cls: 0 }
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__vitals.lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  // Entrance motion must only ever touch its own elements: the page frame stays untransformed.
  const frame = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).transform,
    body: getComputedStyle(document.body).transform,
    h1Height: Math.round(document.querySelector('h1').getBoundingClientRect().height),
  }))
  check('Page frame untransformed during the opening scan', frame.html === 'none' && frame.body === 'none' && frame.h1Height > 40, frame)
  await page.waitForTimeout(2500)
  // The 3D cloud loads on idle; record which tier this device landed on.
  await page.waitForFunction(() => document.querySelector('.cloud')?.dataset.tier !== 'loading', null, { timeout: 8000 }).catch(() => {})
  const cloud = await page.evaluate(() => ({
    tier: document.querySelector('.cloud')?.dataset.tier,
    canvases: document.querySelectorAll('canvas').length,
  }))
  check('3D cloud mounted (animated or still tier)', cloud.tier === 'animated' || cloud.tier === 'still', cloud)
  check('At most one canvas on the page', cloud.canvases <= 1, cloud.canvases)
  const motion = await page.evaluate(async () => {
    const frames = []
    let last = performance.now()
    let id
    const loop = (now) => {
      frames.push(now - last)
      last = now
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    await new Promise((r) => setTimeout(r, 2500))
    cancelAnimationFrame(id)
    const dropped = frames.filter((dt) => dt > 25).length
    const avgFps = 1000 / (frames.reduce((a, b) => a + b, 0) / Math.max(frames.length, 1))
    return { avgFps: Math.round(avgFps), droppedFrames: dropped, frames: frames.length, horizOverflow: document.documentElement.scrollWidth > window.innerWidth }
  })
  const vitals = await page.evaluate(async () => {
    // Read LCP from the buffered timeline as well, in case the early observer missed it.
    const lcp = await new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        resolve(entries.length ? entries[entries.length - 1].startTime : 0)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      setTimeout(() => resolve(window.__vitals.lcp), 500)
    })
    return { lcp, cls: window.__vitals.cls }
  })
  check('DPR-2 scroll avgFps >= 55', motion.avgFps >= 55, motion)
  check('No horizontal overflow (1440)', !motion.horizOverflow, motion.horizOverflow)
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0)
  check('FCP < 1500ms', fcp > 0 && fcp < 1500, Math.round(fcp))
  check('LCP < 2500ms', vitals.lcp > 0 && vitals.lcp < 2500, Math.round(vitals.lcp))
  check('CLS < 0.1', vitals.cls < 0.1, vitals.cls.toFixed(4))

  // Typing drives the spectrum: frame budget while peaks move.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.click('#tra-cuu-o')
  const typing = await page.evaluate(async () => {
    const frames = []
    let last = performance.now()
    let id
    const loop = (now) => {
      frames.push(now - last)
      last = now
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    await new Promise((r) => setTimeout(r, 1500))
    cancelAnimationFrame(id)
    return Math.round(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length))
  })
  await page.keyboard.type('cong thuc', { delay: 60 })
  await page.waitForTimeout(600)
  const hits = await page.locator('.result').count()
  check('Search "cong thuc" (no diacritics) finds results', hits > 0, hits)
  const cloudWhileSearching = await page.evaluate(() => getComputedStyle(document.querySelector('.cloud canvas')).opacity)
  check('3D cloud hidden while a lookup is active', cloudWhileSearching === '0', cloudWhileSearching)
  check('Idle frame rate on hero >= 55', typing >= 55, typing)
  check('0 console errors', errors.length === 0, errors)
  await page.close()
}

// 2. Contrast of the committed token pairs, light and dark, resolved by the browser itself.
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme: scheme })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  const pairs = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const rgb = (value) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const lum = ([r, g, b]) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a, b) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m)
      return (x + 0.05) / (y + 0.05)
    }
    const css = getComputedStyle(document.documentElement)
    const v = (name) => css.getPropertyValue(name).trim()
    const out = {}
    for (const ground of ['--ground', '--ground-elevated']) {
      for (const text of ['--ink', '--ink-secondary', '--accent']) {
        out[`${text} on ${ground}`] = Math.round(ratio(v(text), v(ground)) * 100) / 100
      }
    }
    return out
  })
  for (const [pair, value] of Object.entries(pairs)) check(`Contrast ${scheme}: ${pair} >= 4.5`, value >= 4.5, value)
  await page.close()
}

// 3. Keyboard: Tab reaches the skip link first, then focus rings are visible.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('First Tab stop is the skip link', first?.startsWith('Bỏ qua'), first)
  await page.keyboard.press('Tab')
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
  check('Focus ring visible on second stop', ring !== 'none', ring)
  await page.keyboard.press('Escape')
  await page.evaluate(() => document.activeElement.blur())
  await page.keyboard.press('/')
  const focused = await page.evaluate(() => document.activeElement?.id)
  check('"/" focuses the search field', focused === 'tra-cuu-o', focused)
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('a, button, input')].filter((el) => {
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim()
      const label = el.id && document.querySelector(`label[for="${el.id}"]`)
      return !name && !label
    }).length,
  )
  check('Every control has an accessible name', unnamed === 0, unnamed)
  await page.close()
}

// 4. Reduced motion: no scan arming, content fully visible.
{
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('.cloud')?.dataset.tier !== 'loading', null, { timeout: 8000 }).catch(() => {})
  const state = await page.evaluate(() => ({
    cloud: document.querySelector('.cloud')?.dataset.tier,
    armed: document.querySelector('.instrument')?.dataset.scan === 'armed',
    inkTransform: getComputedStyle(document.querySelector('.ink')).transform,
  }))
  check('Reduced motion: scan never armed', !state.armed, state)
  check('Reduced motion: 3D cloud drawn as a still', state.cloud === 'still', state.cloud)
  check('Reduced motion: spectrum lines at full height', state.inkTransform === 'none' || state.inkTransform === 'matrix(1, 0, 0, 1, 0, 0)', state.inkTransform)
  await page.close()
}

// 5. No-JS floor: every page still renders its copy and links.
{
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  for (const path of ['/', '/tu/aromatic-compound', '/bai/11']) {
    const page = await context.newPage()
    await page.goto(base + path, { waitUntil: 'load' })
    const state = await page.evaluate(() => ({
      htmlDisplay: getComputedStyle(document.documentElement).display,
      h1Height: Math.round(document.querySelector('h1')?.getBoundingClientRect().height ?? 0),
      visibleLinks: [...document.querySelectorAll('main a')].filter((a) => a.getBoundingClientRect().height > 0).length,
    }))
    check(`No JS: ${path} readable`, state.htmlDisplay !== 'none' && state.h1Height > 20 && state.visibleLinks > 0, state)
    await page.close()
  }
  await context.close()
}

await browser.close()
let failed = 0
for (const r of results) {
  if (!r.pass) failed++
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${JSON.stringify(r.detail)}`)
}
process.exit(failed ? 1 : 0)
