<script setup lang="ts">
const { sheet, entries, senseCount } = useLexicon()
</script>

<template>
  <footer class="site-footer">
    <div class="wrap foot">
      <p class="brand-line"><span class="name">ChemDict</span> · Từ điển thuật ngữ Hóa học Anh – Việt</p>
      <p class="label">
        {{ entries.length }} mục từ, {{ senseCount }} dòng dữ liệu. Toàn bộ nội dung chép nguyên văn từ “{{ sheet.title }}”.
        Nhấn <kbd>/</kbd> ở bất kỳ trang nào để tra từ.
      </p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--hairline);
  padding-block: var(--s12) var(--s16);
}

.foot {
  display: grid;
  gap: var(--s3);
}

.brand-line {
  font-size: 1.125rem;
}

.name {
  font-weight: 600;
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
