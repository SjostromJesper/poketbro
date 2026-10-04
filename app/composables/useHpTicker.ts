import { mostRecentTickBoundary } from '#shared/game/regen'

/**
 * Keeps a reactive clock and refetches the character right when a regen tick
 * boundary is crossed, so passive HP regen shows up without a manual reload.
 */
export function useHpTicker() {
  const { load } = useCharacter()
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  let lastBoundary = mostRecentTickBoundary(Date.now())

  onMounted(() => {
    lastBoundary = mostRecentTickBoundary(Date.now())
    timer = setInterval(() => {
      now.value = Date.now()
      const boundary = mostRecentTickBoundary(now.value)
      if (boundary > lastBoundary) {
        lastBoundary = boundary
        load(true)
      }
    }, 1000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { now }
}
