import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_AUDIO_SETTINGS } from '~~/nudge/game/audio'

const STORAGE_KEY = 'nudge:settings:v2'

const clamp01 = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback)

export const useSettingsStore = defineStore('nudgeSettings', () => {
  /** Default battle speed multiplier (1, 2 or 3). */
  const battleSpeed = ref(1)
  const musicVolume = ref(DEFAULT_AUDIO_SETTINGS.musicVolume)
  const sfxVolume = ref(DEFAULT_AUDIO_SETTINGS.sfxVolume)
  const muted = ref(DEFAULT_AUDIO_SETTINGS.muted)
  const debug = ref(false)

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, unknown>
      if (typeof saved.battleSpeed === 'number' && [1, 2, 3].includes(saved.battleSpeed)) battleSpeed.value = saved.battleSpeed
      musicVolume.value = clamp01(saved.musicVolume, musicVolume.value)
      sfxVolume.value = clamp01(saved.sfxVolume, sfxVolume.value)
      if (typeof saved.muted === 'boolean') muted.value = saved.muted
    } catch {
      // Ignore corrupt or unavailable storage.
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        battleSpeed: battleSpeed.value, musicVolume: musicVolume.value, sfxVolume: sfxVolume.value, muted: muted.value,
      }))
    } catch {
      // Ignore unavailable storage.
    }
  }

  watch([battleSpeed, musicVolume, sfxVolume, muted], save)

  return { battleSpeed, musicVolume, sfxVolume, muted, debug, load, save }
})
