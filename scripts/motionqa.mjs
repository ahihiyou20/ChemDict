// Phase 7 gates on the production build: DPR-2 frame budget, Web Vitals, token contrast,
// keyboard focus order, reduced motion, and the home page's train keeping clear of text.
// Usage: node scripts/motionqa.mjs [baseUrl]
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
    window.__vitals = { lcp: 0, cls: 0, tbt: 0 }
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__vitals.tbt += Math.max(0, e.duration - 50)
    }).observe({ type: 'longtask', buffered: true })
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
    return { lcp, cls: window.__vitals.cls, tbt: window.__vitals.tbt }
  })
  check('DPR-2 scroll avgFps >= 55', motion.avgFps >= 55, motion)
  check('No horizontal overflow (1440)', !motion.horizOverflow, motion.horizOverflow)
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0)
  check('FCP < 1500ms', fcp > 0 && fcp < 1500, Math.round(fcp))
  check('LCP < 2500ms', vitals.lcp > 0 && vitals.lcp < 2500, Math.round(vitals.lcp))
  check('CLS < 0.1', vitals.cls < 0.1, vitals.cls.toFixed(4))
  check('TBT < 200ms (long tasks during load and scroll)', vitals.tbt < 200, Math.round(vitals.tbt))

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

// 1b. Motion never holds a lookup: an entry's answer is on screen the moment its page is.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const shown = () =>
    page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          const style = getComputedStyle(n)
          if (style.opacity === '0' || style.visibility === 'hidden') return false
        }
        return ![...el.querySelectorAll('*')].some((child) => getComputedStyle(child).opacity === '0')
      }
      return { path: location.pathname, headword: visible(document.querySelector('h1.headword')), definition: visible(document.querySelector('.def-text')) }
    })
  await page.goto(base + '/tu/aromatic-compound', { waitUntil: 'load' })
  const direct = await shown()
  check('Entry answer visible at load (headword and definition)', direct.headword && direct.definition, direct)
  // Timed inside the page, from the Enter keydown to the first frame that shows the answer uncovered:
  // in the DOM, at full opacity, and above the scene change's wipe while one runs.
  // scene: 'auto' (what a reader gets) or 'wipe' (the view transition forced, whatever the GPU).
  const timeLookup = async (scene) => {
    const lookup = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    if (scene === 'wipe') await lookup.addInitScript(() => sessionStorage.setItem('chemdict-scene', 'wipe'))
    await lookup.goto(base + '/', { waitUntil: 'networkidle' })
    await lookup.click('#tra-cuu-o')
    await lookup.keyboard.type('alkane', { delay: 30 })
    await lookup.waitForSelector('.result')
    await lookup.evaluate(() => {
      // Bottom edge of the wipe's uncovered band, from the pseudo-element's computed inset().
      const uncoveredTo = () => {
        const running = document.getAnimations().some((a) => a.effect?.pseudoElement === '::view-transition-new(root)')
        if (!running) return Infinity
        const clip = getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath
        const args = clip.slice(clip.indexOf('(') + 1, -1).match(/calc\([^)]*\)|[^\s]+/g) ?? []
        const probe = document.createElement('div')
        probe.style.cssText = `position:fixed;top:0;height:${args[2] ?? '0px'};visibility:hidden`
        document.body.append(probe)
        const inset = probe.getBoundingClientRect().height
        probe.remove()
        return innerHeight - inset
      }
      addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Enter') return
          const started = performance.now()
          const look = () => {
            const h1 = document.querySelector('h1.headword')
            const def = document.querySelector('.def-text')
            const ready = location.pathname.startsWith('/tu/') && h1 && def && getComputedStyle(h1).opacity === '1' && getComputedStyle(def).opacity === '1'
            if (ready && def.getBoundingClientRect().bottom <= uncoveredTo()) window.__answered = performance.now() - started
            else requestAnimationFrame(look)
          }
          requestAnimationFrame(look)
        },
        { capture: true, once: true },
      )
    })
    await lookup.waitForTimeout(600)
    const mode = await lookup.evaluate(() => sessionStorage.getItem('chemdict-scene'))
    await lookup.keyboard.press('Enter')
    const elapsed = await lookup.waitForFunction(() => window.__answered, null, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => Infinity)
    await lookup.close()
    return { ms: Math.round(elapsed), mode }
  }
  const { ms: elapsed, mode } = await timeLookup('auto')
  const { ms: forcedWipe } = await timeLookup('wipe')
  await page.goto(base + '/tu/aromatic-compound', { waitUntil: 'load' })
  const after = await shown()
  // The wipe holds the screen for two captures; where those are slow (a software GPU here) the reader
  // gets the sweep instead. forcedWipe records what the wipe would have cost on this machine.
  check('Enter → entry answer uncovered < 150ms, scene change included', elapsed < 150 && after.headword && after.definition, { elapsed, mode, forcedWipe })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  const chrome = await page.evaluate(() => ({ lenis: document.documentElement.classList.contains('lenis') }))
  check('Smooth scroll (Lenis) active with motion allowed', chrome.lenis, chrome)
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  const marquees = await page.evaluate(() => [...document.querySelectorAll('.marquee')].map((el) => el.getAttribute('aria-hidden')))
  check('Exactly one marquee, hidden from assistive tech', marquees.length === 1 && marquees[0] === 'true', marquees)
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
    const input = document.querySelector('#tra-cuu-o')
    const plate = getComputedStyle(input.closest('.plate') ?? input).backgroundColor
    out['search placeholder on plate'] = Math.round(ratio(getComputedStyle(input, '::placeholder').color, plate === 'rgba(0, 0, 0, 0)' ? v('--ground') : plate) * 100) / 100
    for (const ground of ['--ground', '--ground-elevated']) {
      for (const text of ['--ink', '--ink-secondary', '--accent']) {
        out[`${text} on ${ground}`] = Math.round(ratio(v(text), v(ground)) * 100) / 100
      }
    }
    // Lesson flames: text on a flame fill reads as body text; flame marks (lines, dots, outlined
    // initials) are graphics and large display glyphs, so they need 3:1 against either ground.
    for (const n of [10, 11, 12, 13]) {
      out[`--on-flame on --flame-${n}`] = Math.round(ratio(v('--on-flame'), v(`--flame-${n}`)) * 100) / 100
      for (const ground of ['--ground', '--ground-elevated']) {
        out[`--flame-${n}-mark on ${ground}`] = Math.round(ratio(v(`--flame-${n}-mark`), v(ground)) * 100) / 100
      }
    }
    return out
  })
  for (const [pair, value] of Object.entries(pairs)) {
    const floor = pair.includes('-mark on') ? 3 : 4.5
    check(`Contrast ${scheme}: ${pair} >= ${floor}`, value >= floor, value)
  }
  if (scheme === 'light') {
    // Cross-route drift (system register): every route resolves the same tokens and chrome.
    const signature = () =>
      page.evaluate(() => {
        const css = getComputedStyle(document.documentElement)
        const tokens = ['--ground', '--ink', '--ink-secondary', '--accent', '--hairline', '--font-serif', '--font-mono'].map((t) => css.getPropertyValue(t).trim())
        const h = document.querySelector('header')
        return JSON.stringify({ tokens, header: h?.getBoundingClientRect().height, footer: Boolean(document.querySelector('footer')), body: getComputedStyle(document.body).fontFamily })
      })
    const home = await signature()
    const drift = []
    for (const path of ['/tu/aromatic-compound', '/bai/11', '/khong-co-trang-nay']) {
      await page.goto(base + path, { waitUntil: 'networkidle' })
      if ((await signature()) !== home) drift.push(path)
    }
    check('No cross-route token or chrome drift (/, entry, lesson, 404)', drift.length === 0, drift)
  }
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
  check('Reduced motion: no smooth-scroll hijack', !(await page.evaluate(() => document.documentElement.classList.contains('lenis'))), null)
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

// 6. Touch targets at 390px: every control's hit area reaches 44px, counting grown ::after areas.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  for (const path of ['/', '/tu/molecular-formula', '/bai/13']) {
    const page = await context.newPage()
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const small = await page.evaluate(async () => {
      const out = []
      for (const el of document.querySelectorAll('main a, main button, main input, header a, header button')) {
        const style = getComputedStyle(el)
        // Links inside running prose are exempt (WCAG 2.5.8 inline exception).
        if (style.display === 'inline' && el.closest('p:not(.citation):not(.crumbs), li, td, dd')) continue
        let r = el.getBoundingClientRect()
        if (!r.width || !r.height || style.visibility === 'hidden') continue
        if (r.height >= 44 || (r.width >= 44 && r.height >= 44)) continue
        el.scrollIntoView({ block: 'center' })
        await new Promise((done) => requestAnimationFrame(done))
        r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const reach = (y) => {
          const hit = document.elementFromPoint(cx, y)
          return hit === el || el.contains(hit)
        }
        if (!(reach(cy - 21.5) && reach(cy + 21.5))) out.push(`${el.textContent.trim().slice(0, 24)} ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
      return out
    })
    check(`Touch targets >= 44px at 390: ${path}`, small.length === 0, small)
    await page.close()
  }
  await context.close()
}

// 7. The separation train and the instruments around it never cover a word: at the foot of the page,
// with every pipe full, no piece of glass, liquid, recorder paper or bubble intersects a line of text.
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(3000)
  const report = await page.evaluate(() => {
    const home = document.querySelector('.home')
    const train = home.querySelector('.train')
    const wide = train.classList.contains('wide')
    // Liquids sit inside glass a few px wider than themselves.
    const pad = wide ? 3 : 2
    const pieces = []
    const add = (el, inflate = 0) => {
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) return
      pieces.push({ what: el.className.baseVal ?? el.className, l: r.left - inflate, r: r.right + inflate, t: r.top - inflate, b: r.bottom + inflate })
    }
    train.querySelectorAll('.liquid').forEach((el) => add(el, pad))
    train.querySelectorAll('.column, .burette-liquid, .flask-liquid, .recorder, .boil i').forEach((el) => add(el, 2))
    home.querySelectorAll('.coolant').forEach((el) => add(el))
    const text = []
    const walker = document.createTreeWalker(home, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('.train, [aria-hidden="true"] .run ~ .run')) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) if (r.width && r.height) text.push({ text: node.textContent.trim().slice(0, 24), l: r.left, r: r.right, t: r.top, b: r.bottom })
    }
    const hits = []
    for (const p of pieces)
      for (const t of text)
        if (p.l < t.r - 0.5 && p.r > t.l + 0.5 && p.t < t.b - 0.5 && p.b > t.t + 0.5) hits.push(`${p.what} × "${t.text}"`)
    return { pieces: pieces.length, words: text.length, hits: [...new Set(hits)].slice(0, 8), endpoint: train.classList.contains('endpoint') }
  })
  check(`Train never covers text at ${width}`, report.pieces > 10 && report.hits.length === 0, report)
  check(`Titration reaches its endpoint at the foot of the page at ${width}`, report.endpoint, null)
  await page.close()
}

// 8. Reduced motion: the train is drawn finished, with nothing left moving.
{
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const state = await page.evaluate(() => {
    const train = document.querySelector('.train')
    const scales = [...train.querySelectorAll('.liquid')].map((el) => new DOMMatrix(getComputedStyle(el).transform))
    return {
      full: scales.every((m) => Math.abs(m.a - 1) < 0.01 && Math.abs(m.d - 1) < 0.01),
      endpoint: train.classList.contains('endpoint'),
      running: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.train, .lab')).length,
    }
  })
  check('Reduced motion: train drawn finished and still', state.full && state.endpoint && state.running === 0, state)
  await page.close()
}

await browser.close()
let failed = 0
for (const r of results) {
  if (!r.pass) failed++
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${JSON.stringify(r.detail)}`)
}
process.exit(failed ? 1 : 0)
