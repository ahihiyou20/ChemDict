import lexicon from './shared/data/lexicon.json'
import { buildEntries } from './shared/utils/lexicon'
import type { LexiconData } from './shared/types/lexicon'

const entryRoutes = buildEntries(lexicon as LexiconData).map((entry) => `/tu/${entry.slug}`)
const lessonRoutes = lexicon.lessons.map((lesson) => `/bai/${lesson.number}`)

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  css: [
    '@fontsource-variable/newsreader/opsz.css',
    '@fontsource-variable/noto-sans-mono/wght.css',
    '~/assets/css/main.css',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'vi' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#f4f8f9', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#10161c', media: '(prefers-color-scheme: dark)' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      script: [
        {
          // Before first paint: mark JS as available and apply a theme the reader pinned earlier.
          innerHTML:
            "(function(d){d.classList.add('js');try{var t=localStorage.getItem('chemdict-theme');if(t==='light'||t==='dark')d.dataset.theme=t}catch(e){}})(document.documentElement)",
          tagPosition: 'head',
        },
      ],
    },
  },
  nitro: {
    // Plain static output in .output/public on every host, so Vercel and Cloudflare Pages
    // serve the same prerendered files instead of switching to their own Nitro presets.
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/', ...lessonRoutes, ...entryRoutes],
    },
  },
  vite: {
    // three.js (~890 KB raw, ~240 KB gzip) is its own chunk, fetched on idle by the home hero only.
    build: { chunkSizeWarningLimit: 1000 },
    // The benzene scene worker is an ES module worker.
    worker: { format: 'es' },
  },
  typescript: { strict: true },
})
