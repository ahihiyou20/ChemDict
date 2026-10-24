import type { Orama } from '@orama/orama'
import type { Entry } from '#shared/types/lexicon'
import { fold } from '#shared/utils/lexicon'

export type MatchField = 'en' | 'vi' | 'def'

export interface SearchHit {
  entry: Entry
  score: number
  /** Score relative to the best hit, 0–1. */
  relative: number
  field: MatchField
}

const schema = { id: 'string', en: 'string', vi: 'string', defs: 'string' } as const
type LexiconIndex = Orama<typeof schema>

let indexPromise: Promise<LexiconIndex> | null = null

const normalise = (text: string) => fold(text).toLowerCase().replace(/\s+/g, ' ').trim()

function viTerms(entry: Entry) {
  return [...new Set(entry.senses.map((sense) => sense.vi))].join(' ')
}

/** Orama's tokenizer drops Vietnamese diacritics, so every field is indexed pre-folded. */
export function warmLexiconIndex(entries: Entry[]): Promise<LexiconIndex> {
  indexPromise ??= (async () => {
    const { create, insertMultiple } = await import('@orama/orama')
    const db = create({ schema })
    await insertMultiple(
      db,
      entries.map((entry) => ({
        id: entry.slug,
        en: normalise(entry.senses.map((sense) => sense.en).join(' ')),
        vi: normalise(viTerms(entry)),
        defs: normalise(entry.senses.flatMap((sense) => [sense.defVi ?? '', sense.defEn ?? '']).join(' ')),
      })),
    )
    return db
  })()
  return indexPromise
}

export async function searchLexicon(entries: Entry[], query: string): Promise<SearchHit[]> {
  const q = normalise(query)
  if (!q) return []

  const [{ search }, db] = await Promise.all([import('@orama/orama'), warmLexiconIndex(entries)])
  const result = await search(db, {
    term: q,
    properties: ['en', 'vi', 'defs'],
    boost: { en: 3, vi: 3, defs: 1 },
    tolerance: q.length >= 5 ? 1 : 0,
    limit: entries.length,
  })

  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]))
  const scores = new Map<string, number>()
  for (const hit of result.hits) scores.set(hit.id, hit.score)

  // Orama matches whole-word prefixes; "carbon" should still find "Hydrocarbon".
  const floor = Math.max(...scores.values(), 1) * 0.3
  for (const entry of entries) {
    if (!scores.has(entry.slug) && (normalise(entry.en).includes(q) || normalise(viTerms(entry)).includes(q))) {
      scores.set(entry.slug, floor)
    }
  }

  const hits: SearchHit[] = []
  for (const [slug, base] of scores) {
    const entry = bySlug.get(slug)
    if (!entry) continue
    const en = normalise(entry.en)
    const vi = normalise(viTerms(entry))
    let score = base
    if (en === q || vi === q) score *= 3
    else if (en.startsWith(q) || vi.startsWith(q)) score *= 1.6
    else if (en.includes(q) || vi.includes(q)) score *= 1.25
    hits.push({ entry, score, relative: 0, field: matchField(q, en, vi) })
  }

  hits.sort((a, b) => b.score - a.score)
  const best = hits[0]?.score ?? 1
  for (const hit of hits) hit.relative = hit.score / best
  return hits
}

function matchField(q: string, en: string, vi: string): MatchField {
  const words = q.split(' ')
  const covers = (field: string) => {
    const fieldWords = field.split(/[^a-z0-9]+/)
    return words.every((word) => fieldWords.some((fw) => fw.startsWith(word)))
  }
  if (en.includes(q) || covers(en)) return 'en'
  if (vi.includes(q) || covers(vi)) return 'vi'
  return 'def'
}
