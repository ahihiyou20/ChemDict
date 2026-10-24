<script setup lang="ts">
const { lessons, entries, senseCount } = useLexicon()

const filled = lessons.filter((lesson) => lesson.senses.length).map((lesson) => lesson.number)
const lessonList = filled.length > 1 ? `${filled.slice(0, -1).join(', ')} và ${filled.at(-1)}` : String(filled[0] ?? '')

useSeoMeta({
  ogTitle: 'ChemDict · Từ điển thuật ngữ Hóa học Anh – Việt',
  ogDescription: `${entries.length} mục từ Hóa học, tra bằng tiếng Anh hoặc tiếng Việt, kèm định nghĩa song ngữ và nguồn tham khảo.`,
})
</script>

<template>
  <div>
    <section class="hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <div class="hero-copy">
          <h1 id="hero-title" class="hero-title">Từ điển thuật ngữ Hóa học Anh – Việt</h1>
          <p class="hero-lede">
            {{ entries.length }} mục từ ({{ senseCount }} dòng) từ Bài {{ lessonList }}. Gõ tiếng Anh hoặc tiếng Việt để xem
            định nghĩa song ngữ, phiên âm và nguồn tham khảo của từng thuật ngữ.
          </p>
        </div>
        <SpectrumSearch />
      </div>
    </section>
    <AzIndex />
    <LessonLanes />
    <SourceLedger />
  </div>
</template>

<style scoped>
.hero {
  padding-top: clamp(32px, 6vw, 72px);
  padding-bottom: clamp(32px, 5vw, 64px);
}

.hero-inner {
  display: grid;
  gap: clamp(24px, 4vw, 48px);
}

.hero-copy {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  align-items: end;
  gap: var(--s6) clamp(24px, 5vw, 72px);
}

.hero-title {
  font-size: clamp(2.25rem, 5vw, 4.25rem);
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.02;
  font-variation-settings: 'opsz' 72;
}

.hero-lede {
  max-width: 46ch;
  color: var(--ink-secondary);
  font-size: 1.125rem;
}

@media (max-width: 860px) {
  .hero-copy {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
