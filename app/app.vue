<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} · ChemDict` : 'ChemDict · Từ điển thuật ngữ Hóa học Anh – Việt'),
})
useSeoMeta({
  description: 'Từ điển thuật ngữ Hóa học Anh – Việt: tra tiếng Anh hoặc tiếng Việt, xem định nghĩa song ngữ, phiên âm, hình minh họa và nguồn tham khảo.',
  ogSiteName: 'ChemDict',
  ogType: 'website',
})

const route = useRoute()
const pendingFocus = useState('pending-search-focus', () => false)

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isEditable(event.target)) return
  event.preventDefault()
  pendingFocus.value = true
  if (route.path !== '/') navigateTo('/')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <a class="skip-link" href="#noi-dung">Bỏ qua, tới nội dung chính</a>
  <SiteHeader />
  <main id="noi-dung">
    <NuxtPage />
  </main>
  <SiteFooter />
</template>
