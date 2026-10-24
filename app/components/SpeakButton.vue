<script setup lang="ts">
const props = defineProps<{ text: string; id: string }>()
const { supported, speakingId, speak } = usePronounce()
const speaking = computed(() => speakingId.value === props.id)
</script>

<template>
  <!-- Rendered only once the browser proves it can speak, so no dead button without JS. -->
  <button
    v-if="supported"
    type="button"
    class="speak"
    :class="{ 'is-speaking': speaking }"
    :aria-label="`Nghe phát âm: ${text}`"
    @click="speak(text, id)"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" />
      <path class="wave w1" d="M15.2 9.2a4 4 0 0 1 0 5.6" />
      <path class="wave w2" d="M17.8 6.6a7.6 7.6 0 0 1 0 10.8" />
    </svg>
  </button>
</template>

<style scoped>
.speak {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--hairline-strong);
  border-radius: 999px;
  background: var(--ground);
  color: var(--ink);
  cursor: pointer;
  vertical-align: middle;
  transition: color var(--t-press) var(--ease-out), border-color var(--t-press) var(--ease-out),
    transform var(--t-press) var(--ease-out);
}

/* A 44px hit area around the 32px disc. */
.speak::after {
  content: '';
  position: absolute;
  /* Measured from inside the 1px border: 30 + 2 × 7 = 44px of reach. */
  inset: -7px;
}

.speak:hover,
.speak.is-speaking {
  color: var(--accent);
  border-color: var(--accent);
}

.speak:active {
  transform: scale(0.94);
}

.wave {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

@media (prefers-reduced-motion: no-preference) {
  .is-speaking .wave {
    animation: wave 0.9s var(--ease-out) infinite;
  }

  .is-speaking .w2 {
    animation-delay: 0.15s;
  }
}

@keyframes wave {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}
</style>
