/**
 * Reads an English term aloud with the browser's speech synthesis, like the speaker button in an
 * English dictionary. One utterance at a time across the whole page.
 */
const speakingId = ref<string | null>(null)
let voice: SpeechSynthesisVoice | undefined

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
  // Prefer a natural US voice, then any US voice, then any English voice.
  voice =
    voices.find((v) => /^en-us$/i.test(v.lang) && /natural|google|samantha|aria|jenny/i.test(v.name)) ??
    voices.find((v) => /^en[-_]us$/i.test(v.lang)) ??
    voices[0]
}

export function usePronounce() {
  const supported = ref(false)

  onMounted(() => {
    supported.value = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    if (!supported.value) return
    pickVoice()
    // Chrome fills the voice list asynchronously.
    speechSynthesis.addEventListener('voiceschanged', pickVoice)
  })
  onBeforeUnmount(() => {
    if (!supported.value) return
    speechSynthesis.removeEventListener('voiceschanged', pickVoice)
    speechSynthesis.cancel()
    speakingId.value = null
  })

  function speak(text: string, id: string) {
    if (!supported.value) return
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice?.lang ?? 'en-US'
    if (voice) utterance.voice = voice
    utterance.rate = 0.9
    const finish = () => {
      if (speakingId.value === id) speakingId.value = null
    }
    utterance.onend = finish
    utterance.onerror = finish
    speakingId.value = id
    speechSynthesis.speak(utterance)
  }

  return { supported, speakingId: readonly(speakingId), speak }
}
