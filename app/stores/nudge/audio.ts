import { defineStore } from 'pinia'
import { watch } from 'vue'
import { gameData } from '~~/nudge/data'
import { AudioManager } from '~~/nudge/game/audio'
import { cuesForEvent, type Cue } from '~~/nudge/game/audioCues'
import type { JingleId, MusicId, SfxId } from '~~/nudge/game/audio-manifest'
import { WebAudioBackend } from '~~/nudge/game/audioBackend'
import type { BattleEvent, Side } from '~~/nudge/engine/types'
import { useSettingsStore } from './settings'

/** The one place the game asks for sound. Safe to call anywhere (also on the server, where it does nothing). */
export const useAudioStore = defineStore('nudgeAudio', () => {
  const settings = useSettingsStore()
  let manager: AudioManager | null = null

  function get(): AudioManager | null {
    if (manager) return manager
    if (typeof window === 'undefined') return null
    try {
      manager = new AudioManager(new WebAudioBackend())
      manager.setSettings({ musicVolume: settings.musicVolume, sfxVolume: settings.sfxVolume, muted: settings.muted })
    } catch {
      manager = null
    }
    return manager
  }

  watch([() => settings.musicVolume, () => settings.sfxVolume, () => settings.muted], () => {
    manager?.setSettings({ musicVolume: settings.musicVolume, sfxVolume: settings.sfxVolume, muted: settings.muted })
  })

  /** Browsers only play sound after a user gesture: call this from the first click or key press. */
  function unlock(): Promise<boolean> {
    return get()?.unlock() ?? Promise.resolve(false)
  }

  function sfx(id: SfxId, options?: { rate?: number, gain?: number }) {
    get()?.sfx(id, options)
  }

  function music(id: MusicId | null) {
    get()?.playMusic(id)
  }

  function jingle(id: JingleId): Promise<void> {
    return get()?.jingle(id) ?? Promise.resolve()
  }

  function cry(speciesId: number | undefined, options?: { rate?: number }) {
    if (speciesId === undefined) return
    get()?.cry(gameData.species[speciesId]?.cry, options)
  }

  function stopAll() {
    manager?.stopAll()
  }

  function playCue(cue: Cue, speciesOfSide: (side: Side) => number | undefined) {
    // Resolve who cries now: the active Pokémon may change before a delayed cue plays.
    const species = cue.type === 'cry' ? (cue.speciesId ?? speciesOfSide(cue.side)) : undefined
    const run = () => {
      if (cue.type === 'sfx') sfx(cue.id)
      else cry(species, { rate: cue.rate })
    }
    if (cue.delayMs) setTimeout(run, cue.delayMs)
    else run()
  }

  /** Plays the sounds for a batch of battle events. `speciesOfSide` says which Pokémon is active (for cries). */
  function battleEvents(events: BattleEvent[], speciesOfSide: (side: Side) => number | undefined) {
    for (const event of events) for (const cue of cuesForEvent(event)) playCue(cue, speciesOfSide)
  }

  return { unlock, sfx, music, jingle, cry, stopAll, battleEvents }
})
