export interface Citation {
  label: string
  url: string | null
}

export type Illustration =
  | { kind: 'image'; src: string; width: number; height: number; alt: string }
  | { kind: 'text'; text: string }

/** One row of the vocabulary sheet, copied verbatim. */
export interface Sense {
  id: string
  lesson: number
  row: number
  vi: string
  en: string
  ipa: string | null
  pos: string | null
  defVi: string | null
  defEn: string | null
  illustration: Illustration | null
  source: Citation | null
}

export interface Lesson {
  number: number
  title: string
  senses: Sense[]
}

export interface LexiconData {
  lessons: Lesson[]
}

/** A headword: every sense that shares the same English term. */
export interface Entry {
  slug: string
  en: string
  vi: string
  senses: Sense[]
  lessons: number[]
}

export type SortLanguage = 'en' | 'vi'
