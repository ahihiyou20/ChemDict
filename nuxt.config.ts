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
      link: [{ rel: 'icon', type: 'image/svg+xml', href: 'favicon.svg' }],
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
    prerender: {
      crawlLinks: true,
      routes: ['/', ...lessonRoutes, ...entryRoutes],
    },
  },
  typescript: { strict: true },
})
