import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../app/stores/nudge/game'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { useSettingsStore } from '../../app/stores/nudge/settings'
import { useWorldStore } from '../../app/stores/nudge/world'
import { NOTES } from '../game/text/notes'
import { quickIntroSteps } from '../game/text/intro'
import { CutsceneRunner, PRESS_LOCK_MS } from '../game/cutscene'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())

describe('skipping the intro and the professor\'s notes', () => {
  it('cannot be skipped the first time on a device, and unlocks the three notes the intro explains', () => {
    const game = useGameStore()
    const settings = useSettingsStore()
    const player = usePlayerStore()
    game.newGame()
    game.beginIntro()
    game.skipIntro()
    expect(game.introMode).toBe('full') // not allowed before the intro has been seen
    game.finishIntro({ player: 'Maja', rival: 'Noa', playerSprite: 'player' })
    expect(settings.introSeen).toBe(true)
    expect(player.notes).toEqual(['atb', 'nudge', 'trust'])
    expect(useWorldStore().world!.hasFlag('tutorial-off')).toBe(false)
  })

  it('can be skipped in a later new game: short questions only, pauses off, every note readable', () => {
    const game = useGameStore()
    const settings = useSettingsStore()
    const player = usePlayerStore()
    settings.introSeen = true
    game.newGame()
    game.beginIntro()
    game.skipIntro()
    expect(game.introMode).toBe('quick')
    game.finishIntro({ player: 'Olle', rival: 'Max', playerSprite: 'player2' })
    expect(useWorldStore().world!.hasFlag('tutorial-off')).toBe(true)
    expect(new Set(player.notes)).toEqual(new Set(NOTES.map(n => n.id)))
    expect(player.look).toBe('player2')
  })

  it('unlocks the other notes when the game explains them (starter choice, first favorite...)', () => {
    const game = useGameStore()
    const player = usePlayerStore()
    game.newGame()
    game.unlockNote('favorite')
    expect(player.notes).toEqual(['favorite'])
    game.unlockNote('favorite')
    expect(player.notes).toEqual(['favorite'])
  })

  it('the quick version asks for the name, the look and the rival, nothing else', () => {
    const c = new CutsceneRunner(quickIntroSteps({ lookCount: 2 }))
    c.start()
    const asked: string[] = []
    for (let guard = 0; guard < 100 && !c.finished; guard++) {
      for (let t = 0; t < PRESS_LOCK_MS + 40; t += 16) c.update(16)
      const p = c.state.prompt
      if (p) {
        asked.push(`${p.kind}:${p.name}`)
        c.answer(p.kind === 'input' ? (p.name === 'player' ? 'Lo' : 'Max') : p.name === 'look' ? 1 : 'Ja')
      } else if (c.state.text) c.press()
    }
    expect(asked).toEqual(['input:player', 'choice:playerOk', 'choice:look', 'input:rival', 'choice:rivalOk'])
    expect(c.vars).toMatchObject({ player: 'Lo', rival: 'Max', playerSprite: 'player2' })
  })

  it('the notes have a title and text each, with unique ids', () => {
    expect(new Set(NOTES.map(n => n.id)).size).toBe(NOTES.length)
    for (const n of NOTES) {
      expect(n.title.length).toBeGreaterThan(0)
      expect(n.lines.length).toBeGreaterThan(0)
    }
  })
})
