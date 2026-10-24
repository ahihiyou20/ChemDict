import type { Entry, LexiconData, SortLanguage } from '../types/lexicon'

/** Strip Vietnamese diacritics so "hop chat" finds "Hợp chất". */
export function fold(text: string): string {
  return text
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function slugify(text: string): string {
  return fold(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function buildEntries(data: LexiconData): Entry[] {
  const bySlug = new Map<string, Entry>()
  for (const lesson of data.lessons) {
    for (const sense of lesson.senses) {
      const slug = slugify(sense.en)
      const entry = bySlug.get(slug)
      if (entry) {
        entry.senses.push(sense)
        if (!entry.lessons.includes(sense.lesson)) entry.lessons.push(sense.lesson)
      } else {
        bySlug.set(slug, { slug, en: sense.en, vi: sense.vi, senses: [sense], lessons: [sense.lesson] })
      }
    }
  }
  return [...bySlug.values()]
}

const collators: Record<SortLanguage, Intl.Collator> = {
  en: new Intl.Collator('en', { sensitivity: 'base' }),
  vi: new Intl.Collator('vi', { sensitivity: 'base' }),
}

export function sortEntries(entries: Entry[], lang: SortLanguage): Entry[] {
  return [...entries].sort((a, b) => collators[lang].compare(a[lang], b[lang]))
}

/** Index letter for A–Z grouping; Vietnamese keeps Đ as its own letter. */
export function initialOf(text: string): string {
  const first = text.trim().charAt(0)
  if (first === 'đ' || first === 'Đ') return 'Đ'
  return fold(first).toUpperCase()
}

export function groupByInitial(entries: Entry[], lang: SortLanguage): { letter: string; entries: Entry[] }[] {
  const groups: { letter: string; entries: Entry[] }[] = []
  for (const entry of sortEntries(entries, lang)) {
    const letter = initialOf(entry[lang])
    const last = groups[groups.length - 1]
    if (last && last.letter === letter) last.entries.push(entry)
    else groups.push({ letter, entries: [entry] })
  }
  return groups
}

export interface TextPart {
  text: string
  sub: boolean
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'

/** Split text so Unicode subscript digits (CH₂) render as <sub>, which every font can draw. */
export function chemParts(text: string): TextPart[] {
  const parts: TextPart[] = []
  for (const ch of text) {
    const digit = SUBSCRIPT_DIGITS.indexOf(ch)
    const sub = digit >= 0
    const value = sub ? String(digit) : ch
    const last = parts[parts.length - 1]
    if (last && last.sub === sub) last.text += value
    else parts.push({ text: value, sub })
  }
  return parts
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
