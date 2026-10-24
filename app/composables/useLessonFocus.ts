import type { Ref } from 'vue'

/**
 * Pointing at anything that belongs to one lesson (a strip, a spectrum column, a ledger tag, an index
 * term, a flame band) lights that lesson across the whole home page: `data-focus` on the page root,
 * read by main.css. Delegated from the root, mouse and trackpad only, with a short intent delay so a
 * pointer crossing the page does not flicker it.
 */
const SOURCES = '.strip, .spectrum .column, .axis-x .tick, .tag, .item, .flame-bar i, .plate-flame i'

export function useLessonFocus(root: Ref<HTMLElement | null>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop: (() => void) | undefined

  onMounted(() => {
    const home = root.value
    if (!home || !matchMedia('(pointer: fine)').matches) return
    const set = (lesson: string | undefined) => {
      clearTimeout(timer)
      timer = setTimeout(
        () => {
          if (lesson) home.dataset.focus = lesson
          else delete home.dataset.focus
        },
        lesson ? 70 : 140,
      )
    }
    const lessonAt = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>(SOURCES)?.closest<HTMLElement>('[data-lesson]')?.dataset.lesson : undefined
    const over = (event: PointerEvent) => {
      const lesson = lessonAt(event.target)
      if (lesson !== home.dataset.focus || !lesson) set(lesson)
    }
    const leave = () => set(undefined)
    home.addEventListener('pointerover', over)
    home.addEventListener('pointerleave', leave)
    stop = () => {
      clearTimeout(timer)
      home.removeEventListener('pointerover', over)
      home.removeEventListener('pointerleave', leave)
      delete home.dataset.focus
    }
  })

  onBeforeUnmount(() => stop?.())
}
