<script setup lang="ts">
const { entries } = useLexicon()

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
          <div class="hero-text">
            <h1 id="hero-title" class="hero-title">Từ điển thuật ngữ Hóa học Anh – Việt</h1>
          </div>
          <BenzeneCloud class="hero-cloud" />
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
  padding-top: clamp(32px, 5vw, 56px);
  padding-bottom: clamp(32px, 5vw, 64px);
  overflow-x: clip;
}

.hero-inner {
  display: grid;
  gap: clamp(24px, 4vw, 48px);
}

.hero-copy {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  align-items: end;
  gap: var(--s6) clamp(24px, 5vw, 72px);
}

.hero-text {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--s5);
}

.hero-title {
  font-size: clamp(2.25rem, 5vw, 4.25rem);
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.02;
  font-variation-settings: 'opsz' 72;
}

@media (max-width: 860px) {
  .hero-copy {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
