import raw from '#shared/data/lexicon.json'
import type { Entry, LexiconData } from '#shared/types/lexicon'
import { buildEntries, sortEntries } from '#shared/utils/lexicon'

const data = raw as LexiconData
const entries = buildEntries(data)
const bySlug = new Map(entries.map((entry) => [entry.slug, entry]))
const bySense = new Map(entries.flatMap((entry) => entry.senses.map((sense) => [sense.id, entry] as const)))
const sortedEn = sortEntries(entries, 'en')
const senseCount = data.lessons.reduce((total, lesson) => total + lesson.senses.length, 0)

export function useLexicon() {
  return {
    sheet: data.sheet,
    lessons: data.lessons,
    entries,
    sortedEn,
    senseCount,
    entryBySlug: (slug: string): Entry | undefined => bySlug.get(slug),
    entryOfSense: (senseId: string): Entry => bySense.get(senseId)!,
  }
}
