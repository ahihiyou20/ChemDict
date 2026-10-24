export interface Citation {
  label: string
  url: string | null
}

/** Apparatus the site draws itself, for terms whose picture lives on another site. */
export type DiagramName =
  | 'separation'
  | 'distillation'
  | 'evaporation'
  | 'extraction'
  | 'solution'
  | 'crystallization'
  | 'filtration'
  | 'chromatography'

export type Illustration =
  | { kind: 'image'; src: string; width: number; height: number; alt: string }
  | { kind: 'text'; text: string }
  | { kind: 'diagram'; name: DiagramName }

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
  /** "Bài 11" */
  title: string
  /** The lesson's subject, e.g. "Phương pháp tách biệt và tinh chế hợp chất hữu cơ" */
  name: string
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
