<script setup lang="ts">
</script>

<template>
  <footer class="site-footer">
    <div class="wrap foot">
      <div class="foot-top">
        <p class="label">Nhấn <kbd>/</kbd> ở bất kỳ trang nào để tra từ.</p>
        <ThemeToggle />
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--hairline);
  padding-block: var(--s8) var(--s12);
}

.foot {
  display: grid;
  gap: var(--s3);
}

.foot-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
}

.label {
  max-width: 70ch;
}

kbd {
  font-family: var(--font-mono);
  padding: 0 5px;
  border: 1px solid var(--hairline-strong);
  border-radius: 4px;
}
</style>
