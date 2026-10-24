<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
useSeoMeta({ title: props.error.statusCode === 404 ? 'Không tìm thấy' : 'Đã có lỗi' })
</script>

<template>
  <div>
    <SiteHeader />
    <main class="wrap error-page">
      <p class="label">Lỗi {{ error.statusCode }}</p>
      <h1>{{ error.statusCode === 404 ? 'Không có trang này trong từ điển' : 'Đã có lỗi khi mở trang' }}</h1>
      <button type="button" class="back" @click="clearError({ redirect: '/' })">Về trang tra cứu</button>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.error-page {
  display: grid;
  gap: var(--s4);
  justify-items: start;
  padding-block: clamp(64px, 12vw, 160px);
}

h1 {
  font-size: clamp(2.25rem, 5vw, 4rem);
  max-width: 18ch;
}

.back {
  min-height: 48px;
  padding: 0 var(--s6);
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: var(--ink);
  color: var(--ground);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out);
}

.back:hover {
  background: var(--accent);
  border-color: var(--accent);
}
</style>
