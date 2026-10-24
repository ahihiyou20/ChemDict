<script setup lang="ts">
import { chemParts } from '#shared/utils/lexicon'

const props = defineProps<{ text: string }>()
const parts = computed(() => chemParts(props.text))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <sub v-if="part.sub">{{ part.text }}</sub>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
