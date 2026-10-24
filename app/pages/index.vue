<script setup lang="ts">
import { pointerLift } from '~/lib/motion-kit'

const { entries } = useLexicon()

useSeoMeta({
  ogTitle: 'ChemDict · Từ điển thuật ngữ Hóa học Anh – Việt',
  ogDescription: `${entries.length} mục từ Hóa học, tra bằng tiếng Anh hoặc tiếng Việt, kèm định nghĩa song ngữ và nguồn tham khảo.`,
})

const title = ref<HTMLElement | null>(null)
const home = ref<HTMLElement | null>(null)
useLessonFocus(home)

// The opening: the title's characters flip up into place and the flame bar burns in under "Hóa học".
useMotionScope(title, ({ gsap, SplitText, finePointer }, root) => {
  const entering = revealPre(root)
  const bands = root.querySelectorAll('.flame-bar i')
  let release: (() => void) | undefined
  const split = SplitText.create(root, {
    type: 'words,chars',
    ignore: '.flame-bar',
    onSplit(self) {
      release?.()
      if (finePointer) release = pointerLift(gsap, root, self.chars as HTMLElement[])
    },
  })
  if (entering) {
    gsap.set(split.chars, { transformPerspective: 600, transformOrigin: '50% 100%' })
    gsap
      .timeline({ delay: 0.1 })
      .from(split.chars, {
        yPercent: 90,
        rotationX: -80,
        opacity: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.024,
      })
      .from(bands, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.5, ease: 'power3.out', stagger: 0.09 }, 0.55)
  }
  return () => {
    release?.()
    split.revert()
  }
})
</script>

<template>
  <div ref="home" class="home">
    <section class="hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <div class="hero-copy">
          <div class="hero-text">
            <h1 id="hero-title" ref="title" class="hero-title" data-pre>
              Từ điển thuật ngữ <span class="hl">Hóa học<span class="flame-bar" aria-hidden="true"><i data-lesson="10" /><i data-lesson="11" /><i data-lesson="12" /><i data-lesson="13" /></span></span> Anh – Việt
            </h1>
          </div>
          <MoleculeCloud />
        </div>
        <SpectrumSearch />
      </div>
    </section>
    <TermMarquee />
    <AzIndex />
    <LessonLanes />
    <SourceLedger />
    <ReactionTrain />
  </div>
</template>

<style scoped>
/* The train's glass is measured against this box. */
.home {
  position: relative;
}

.hero {
  --hero-pad-top: clamp(32px, 5vw, 56px);
  --hero-gap: clamp(24px, 4vw, 48px);
  position: relative;
  padding-top: var(--hero-pad-top);
  padding-bottom: clamp(32px, 5vw, 64px);
  overflow-x: clip;
}

.hero-inner {
  display: grid;
  gap: var(--hero-gap);
}

.hero-copy {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  align-items: end;
  min-height: clamp(300px, 44vh, 460px);
  gap: var(--s6) clamp(24px, 5vw, 72px);
}

.hero-text {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--s5);
}

.hero-title {
  font-size: clamp(2.5rem, 5.6vw, 5rem);
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variation-settings: 'opsz' 72;
}

.hl {
  position: relative;
  display: inline-block;
  color: var(--accent);
}

/* Four flame-test bands burn under the subject. */
.flame-bar {
  position: absolute;
  left: 0.04em;
  right: 0.04em;
  bottom: -0.06em;
  display: flex;
  gap: 0.08em;
  height: 0.09em;
}

.flame-bar i {
  flex: 1;
  border-radius: 1px;
  background: var(--flame);
}

/* Narrow screens stack the stage over the title: the molecule floats above, the words sit at the foot. */
@media (max-width: 860px) {
  .hero-copy {
    grid-template-columns: minmax(0, 1fr);
    min-height: clamp(280px, 70vw, 440px);
  }
}
</style>
