# CINEMA-QA: ChemDict production verification

All gates were run against the **production build** (`npm run build`, served from `.output/public`), never against the dev server. Results are dated 2026-10-24, at commit `claude/project-thread-8o54e3`.

To reproduce:

```sh
npm run build && npx serve .output/public -l 4173
node scripts/motionqa.mjs http://localhost:4173    # 41 numeric gates, exits non-zero on any FAIL
node scripts/shoot.mjs http://localhost:4173       # 390 / 768 / 1440 sweep; env SCHEMES=light,dark, REDUCED=1, NOJS=1
```

**Result: 41 / 41 gates PASS.** The visual sweep is clean:

- 36 light and dark screenshots across 6 routes and 3 viewports, plus the reduced-motion and no-JS runs.
- 0 horizontal overflow, 0 console errors and 0 failed requests.

## Test environment, and what it can and cannot prove

- The runs used headless Chromium in a cloud container, driven by the Playwright library (the same engine the Playwright MCP uses; the MCP server is not attached to this session).
- The container has **no GPU**. WebGL runs on SwiftShader (CPU emulation), and WebGPU is unavailable, so three.js takes its automatic WebGL2 fallback.
- **On this machine the 3D cloud lands on the `still` tier.** It detects the software GPU and draws one art-directed frame at pixel ratio 1, which is the behaviour the tiers are designed to produce.
- The **animated tier** was checked separately on a temporary build with software detection switched off. Results:
  - The cloud turns, and theme changes reach the worker.
  - 0 console errors.
  - The main thread holds 60 fps at DPR 1 and DPR 2 while the cloud animates.
  - The DPR-2 scroll test reaches 50 fps at pixel ratio 1.5 and 55 fps at pixel ratio 1. That cost is software compositing, which grows with canvas pixels and is why software GPUs get the still tier.
- **Not verifiable here:**
  - The animated tier's frame budget on a real GPU.
  - The WebGPU backend itself.
  - Safari, Firefox and physical phones.

  On a real device the runtime governor still freezes the cloud if the page or the worker drops below about 45 fps. One look at the deployed preview on a real laptop and phone settles these.

## 7.1 Accessibility and interaction

| Gate | Result | Measured |
|------|--------|----------|
| Accessibility tree: every link, button and input has a name | PASS | 0 unnamed controls; the ARIA snapshot shows labelled regions, a search landmark and a status region |
| First Tab stop is the skip link | PASS | "Bỏ qua, tới nội dung chính" |
| Visible `:focus-visible` ring | PASS | 2px solid accent outline |
| `/` focuses the search from anywhere | PASS | `#tra-cuu-o` |
| Primary flow: search without diacritics | PASS | "cong thuc" → 8 results |
| Arrow-key result navigation, Enter opens entry | PASS | "ankan", then ArrowDown focuses *Alkane*, then Enter opens `/tu/alkane` |
| 0 console errors, 0 unhandled rejections, 0 failed requests | PASS | `[]` on every route, viewport and scheme |

## 7.2 Responsive sweep (390 / 768 / 1440)

| Gate | Result | Measured |
|------|--------|----------|
| 0 horizontal overflow | PASS | 36/36 light and dark captures, plus reduced-motion and no-JS runs |
| Headlines ≤ 4 lines at 390 | PASS | Hero 2 lines; the longest headwords (*theory of chemical structure*, *Mass-to-charge ratio*) take 2 lines |
| Touch targets ≥ 44 × 44 at 390 | PASS | `/`, `/tu/molecular-formula`, `/bai/13`. Crumbs, pills, citations and ledger links use grown hit areas. |
| Pointer parallax only on `(pointer: fine)` | PASS | The listener is attached only for fine pointers |
| 3D on narrow screens | PASS | A backdrop behind the display title, masked out before the body copy, so it never pushes the search down |

## 7.3 DPR-2 frame budget (1440 × 900 @2x)

| Gate | Result | Measured |
|------|--------|----------|
| Full-page smooth scroll, avgFps ≥ 55 | PASS | 60 fps, 0 dropped frames out of 150 |
| Idle hero frame rate | PASS | 61 fps |
| At most one canvas | PASS | 1 |
| Page frame untransformed during the opening scan | PASS | `html` / `body` transform `none` |
| 3D hidden while a lookup is active | PASS | canvas opacity 0, render loop paused |

## Core Web Vitals (production build, motion allowed)

| Metric | Target | Measured | Result |
|--------|--------|----------|--------|
| FCP | < 1.5s | 172 ms | PASS |
| LCP | < 2.5s | 172 ms (hero title) | PASS |
| CLS | < 0.1 | 0.0002 | PASS |
| TBT | < 200ms | 63 ms | PASS |

Bundle facts:

- **Critical path:** about 89 KB gzip of JS, the HTML and two variable fonts.
- **three.js:** about 240 KB gzip, fetched on idle by the home page only.
- **Fallback copy of three.js:** the main-thread copy is fetched only where a worker cannot draw.

## 7.4 Progressive enhancement and reduced motion

| Gate | Result | Measured |
|------|--------|----------|
| Reduced motion: no scan, lines at full height | PASS | `data-scan` never armed; `.ink` transform `none` |
| Reduced motion: 3D frozen on an art-directed still | PASS | tier `still` |
| No JS: every page type readable | PASS | `/` 94 links, `/tu/aromatic-compound` 6, `/bai/11` 18; h1 visible |
| No-JS fallbacks | PASS | The search notes that it needs JS and points to the A–Z index; the 3D figure is removed |

## Numeric craft floor

| Gate | Result | Measured |
|------|--------|----------|
| Contrast, light theme | PASS | ink 15.34, secondary 6.59, accent 5.49 on ground; 14.07 / 6.05 / 5.03 on the elevated ground |
| Contrast, dark theme | PASS | ink 16.26, secondary 8.78, accent 8.17 on ground; 14.81 / 7.99 / 7.44 on the elevated ground |
| Input placeholder ≥ 4.5 | PASS | 6.05 light, 7.99 dark |
| UI timings and easing | PASS | 140ms press, 220ms peak, ease-out everywhere; the only over-300ms transitions are the choreographed canvas settle (reason in COMMIT-SHEET §4) |
| Compositor-only animation | PASS | transform and opacity, plus a one-off clip-path wipe |
| Cross-route drift (system register) | PASS | `/`, entry, lesson and 404 resolve identical tokens, fonts, header and footer |

## Phase 6

All 18 anti-slop rules PASS. The table is in `COMMIT-SHEET.md` §8.

## Defects found by QA and fixed in this pass

1. **The whole page squashed for about 4s on load.** Vue scoped CSS compiles `:global(html.js) .x .y` to just `html.js`, so the scan's waiting state set `transform: scaleY(.04)` on `<html>`. The same bug set `html:not(.js) { display: none }`, which blanked every page without JS. It also explained why LCP was never reported. New gates now guard the page frame and no-JS readability.
2. **Parsing three.js blocked the main thread for about 490ms** (TBT 534ms). It moved to a worker, and TBT is now 63ms.
3. **The favicon used a relative URL,** so it returned 404 on every nested route.
4. **Touch targets under 44px:** crumbs, citation links and ledger links.
5. **The 404 page had no footer** (cross-route drift).
