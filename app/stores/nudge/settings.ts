import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'nudge:settings:v1'

export const useSettingsStore = defineStore('nudgeSettings', () => {
  /** Default battle speed multiplier (1, 2 or 3). */
  const battleSpeed = ref(1)
  const sound = ref(false)
  const debug = ref(false)

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { battleSpeed?: number, sound?: boolean }
      if (saved.battleSpeed && [1, 2, 3].includes(saved.battleSpeed)) battleSpeed.value = saved.battleSpeed
      if (typeof saved.sound === 'boolean') sound.value = saved.sound
    } catch {
      // Ignore corrupt or unavailable storage.
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ battleSpeed: battleSpeed.value, sound: sound.value }))
    } catch {
      // Ignore unavailable storage.
    }
  }

  watch([battleSpeed, sound], save)

  return { battleSpeed, sound, debug, load, save }
})
