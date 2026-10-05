import { describe, expect, it, vi } from 'vitest'
import { CutsceneRunner, PRESS_LOCK_MS, type CutsceneStep } from '../game/cutscene'

/** Plays `ms` of time in 16 ms frames. */
function run(c: CutsceneRunner, ms: number) {
  for (let t = 0; t < ms; t += 16) c.update(16)
}

/** Types the current line out and presses once (the way a player would read a line and press). */
function readAndPress(c: CutsceneRunner) {
  run(c, 4000)
  c.press()
  run(c, PRESS_LOCK_MS + 20)
}

describe('cutscene engine', () => {
  it('plays text lines in order, one press per line, and finishes', () => {
    const c = new CutsceneRunner([{ type: 'text', lines: ['Ett', 'Två'], speaker: 'Ek' }, { type: 'text', lines: ['Tre'] }])
    c.start()
    expect(c.state.text).toMatchObject({ speaker: 'Ek', line: 'Ett', lineIndex: 0 })
    readAndPress(c)
    expect(c.state.text).toMatchObject({ line: 'Två' })
    readAndPress(c)
    expect(c.state.text).toMatchObject({ line: 'Tre' })
    readAndPress(c)
    expect(c.finished).toBe(true)
    expect(c.state.text).toBeNull()
  })

  it('types the text out, and the first press shows the whole line before the next press moves on', () => {
    const c = new CutsceneRunner([{ type: 'text', lines: ['Hej där, välkommen!'] }, { type: 'text', lines: ['Nästa'] }])
    c.start()
    run(c, 200)
    const shown = Math.floor(c.state.text!.revealed)
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThan('Hej där, välkommen!'.length)
    c.press()
    expect(c.state.text!.revealed).toBe('Hej där, välkommen!'.length)
    expect(c.state.text!.line).toBe('Hej där, välkommen!')
    run(c, 200)
    c.press()
    expect(c.state.text!.line).toBe('Nästa')
  })

  it('does not let a quick double press (or a held key) skip a step', () => {
    const c = new CutsceneRunner([{ type: 'text', lines: ['A'] }, { type: 'text', lines: ['B'] }, { type: 'text', lines: ['C'] }])
    c.start()
    run(c, 2000)
    c.press()
    expect(c.state.text!.line).toBe('B')
    // Pressing again at once (a key repeat) does nothing: the new line is not even typed yet and the lock is on.
    c.press()
    c.press()
    expect(c.state.text!.line).toBe('B')
    run(c, 2000)
    c.press()
    expect(c.state.text!.line).toBe('C')
  })

  it('runs the silent steps (sounds, sprites, highlight) straight through and stops at the next text', () => {
    const cry = vi.fn()
    const music = vi.fn()
    const jingle = vi.fn()
    const steps: CutsceneStep[] = [
      { type: 'playMusic', id: 'home' },
      { type: 'showSprite', id: 'ek', sprite: { kind: 'character', sprite: 'professor' }, at: 'left' },
      { type: 'showSprite', id: 'eevee', sprite: { kind: 'pokemon', speciesId: 133 }, at: 'right', anim: 'pop' },
      { type: 'playCry', speciesId: 133 },
      { type: 'jingle', id: 'favorite' },
      { type: 'highlight', illustration: 'atb' },
      { type: 'text', lines: ['Hej'] },
    ]
    const c = new CutsceneRunner(steps, { cry, music, jingle })
    c.start()
    expect(music).toHaveBeenCalledWith('home')
    expect(cry).toHaveBeenCalledWith(133)
    expect(jingle).toHaveBeenCalledWith('favorite')
    expect(c.state.sprites.map(s => [s.id, s.at])).toEqual([['ek', 'left'], ['eevee', 'right']])
    expect(c.state.illustration).toBe('atb')
    expect(c.state.text!.line).toBe('Hej')
  })

  it('slides sprites in over time and removes hidden ones', () => {
    const c = new CutsceneRunner([
      { type: 'showSprite', id: 'a', sprite: { kind: 'player' } },
      { type: 'wait', ms: 1000 },
      { type: 'hideSprite', id: 'a', anim: 'shrink' },
      { type: 'wait', ms: 2000 },
      { type: 'text', lines: ['Klart'] },
    ])
    c.start()
    expect(c.state.sprites[0].progress).toBe(0)
    run(c, 400)
    expect(c.state.sprites[0].progress).toBeGreaterThan(0.5)
    run(c, 400)
    expect(c.state.sprites[0].progress).toBe(1)
    run(c, 300)
    expect(c.state.sprites[0].leaving).toBe('shrink')
    run(c, 2000)
    expect(c.state.sprites).toEqual([])
    expect(c.state.text!.line).toBe('Klart')
  })

  it('waits and fades before moving on', () => {
    const c = new CutsceneRunner([{ type: 'fade', to: 'black', ms: 0 }, { type: 'fade', to: 'clear', ms: 800 }, { type: 'wait', ms: 300 }, { type: 'text', lines: ['Nu'] }])
    c.start()
    expect(c.state.blackness).toBe(1)
    expect(c.state.text).toBeNull()
    run(c, 400)
    expect(c.state.blackness).toBeCloseTo(0.5, 1)
    run(c, 480)
    expect(c.state.blackness).toBe(0)
    expect(c.state.text).toBeNull()
    run(c, 320)
    expect(c.state.text!.line).toBe('Nu')
  })

  it('asks for a name and puts it into later text; presses do not answer a question', () => {
    const c = new CutsceneRunner([
      { type: 'input', name: 'player', prompt: 'Vad heter du?', suggestions: ['Alex', 'Sam'], maxLength: 10 },
      { type: 'text', lines: ['Hej {player}! Hej {nobody}!'] },
    ])
    c.start()
    expect(c.state.prompt).toMatchObject({ kind: 'input', maxLength: 10, suggestions: ['Alex', 'Sam'] })
    c.press()
    expect(c.state.prompt).not.toBeNull()
    run(c, 400)
    expect(c.answer('')).toBe(false)
    expect(c.answer('Elfenbenskusten')).toBe(false)
    expect(c.answer('  Alex ')).toBe(true)
    expect(c.vars.player).toBe('Alex')
    expect(c.state.text!.line).toBe('Hej Alex! Hej {nobody}!')
  })

  it('loops back to ask again when the player says no, and goes on when they say yes', () => {
    const steps: CutsceneStep[] = [
      { type: 'label', name: 'ask' },
      { type: 'input', name: 'player', prompt: 'Namn?', suggestions: [], maxLength: 10 },
      { type: 'choice', name: 'ok', prompt: 'Så du heter {player}?', options: ['Ja', 'Nej'] },
      { type: 'jump', to: 'ask', when: { variable: 'ok', equals: 'Nej' } },
      { type: 'text', lines: ['Välkommen {player}'] },
    ]
    const c = new CutsceneRunner(steps)
    c.start()
    run(c, 400)
    c.answer('Lisa')
    run(c, 400)
    expect(c.state.prompt).toMatchObject({ kind: 'choice', prompt: 'Så du heter Lisa?' })
    expect(c.answer(1)).toBe(true) // Nej
    expect(c.state.prompt).toMatchObject({ kind: 'input' })
    run(c, 400)
    c.answer('Olle')
    run(c, 400)
    c.answer('Ja')
    expect(c.vars).toMatchObject({ player: 'Olle', ok: 'Ja', okIndex: '0' })
    expect(c.state.text!.line).toBe('Välkommen Olle')
  })

  it('runs code steps that can set variables and pick a branch', () => {
    const seen: string[] = []
    const c = new CutsceneRunner([
      { type: 'run', fn: (vars) => { vars.mood = 'glad'; seen.push('ran'); return 'happy' } },
      { type: 'text', lines: ['sorgligt'] },
      { type: 'label', name: 'happy' },
      { type: 'text', lines: ['Jag är {mood}'] },
    ])
    c.start()
    expect(seen).toEqual(['ran'])
    expect(c.state.text!.line).toBe('Jag är glad')
  })

  it('throws on a jump to a missing label and on a loop that never waits', () => {
    expect(() => new CutsceneRunner([{ type: 'jump', to: 'nowhere' }]).start()).toThrow(/no label/)
    expect(() => new CutsceneRunner([{ type: 'label', name: 'a' }, { type: 'jump', to: 'a' }]).start()).toThrow(/too many steps/)
  })

  it('types faster with a higher text speed', () => {
    const slow = new CutsceneRunner([{ type: 'text', lines: ['x'.repeat(100)] }])
    const fast = new CutsceneRunner([{ type: 'text', lines: ['x'.repeat(100)] }], {}, { speed: 3 })
    slow.start()
    fast.start()
    run(slow, 500)
    run(fast, 500)
    expect(fast.state.text!.revealed).toBeGreaterThan(slow.state.text!.revealed * 2)
  })
})
