import { describe, expect, it } from 'vitest'
import { ATB_PROMPT_DELAY_MS, MOVE_PROMPT_ATB, Tutorial, TUTORIAL_LOCK_MS, type TutorialInput } from '../game/tutorial'
import type { BattleEvent } from '../engine/types'

const input = (over: Partial<TutorialInput> = {}): TutorialInput => ({ timeMs: 0, atb: 0, nudgesUsed: 0, ready: true, ...over })
const chosen = (followedNudge: boolean | null): BattleEvent => ({ type: 'move-chosen', side: 'player', name: 'X', move: 'tackle', moveName: 'Tackle', followedNudge, favorite: false })

function wait(t: Tutorial, ms: number, i: Partial<TutorialInput> = {}) {
  for (let elapsed = 0; elapsed < ms; elapsed += 16) t.update(input(i), [])
}

describe('the guided first battle', () => {
  it('goes through the four explanations in order, pausing the battle at each', () => {
    const t = new Tutorial()
    t.update(input({ timeMs: 0 }), [])
    expect(t.blocking).toBe(false)

    // 1. The ATB bars, a little after both are out.
    t.update(input({ timeMs: ATB_PROMPT_DELAY_MS + 16 }), [])
    expect(t.prompt).toMatchObject({ id: 'atb', focus: 'atb' })
    expect(t.blocking).toBe(true)
    wait(t, TUTORIAL_LOCK_MS + 20)
    expect(t.dismiss()).toBe(true)
    expect(t.blocking).toBe(false)

    // 2. Move buttons: not before the bar is filled enough, then it waits for a nudge and cannot be dismissed.
    t.update(input({ timeMs: 2000, atb: MOVE_PROMPT_ATB - 0.1 }), [])
    expect(t.prompt).toBeNull()
    t.update(input({ timeMs: 2400, atb: MOVE_PROMPT_ATB }), [])
    expect(t.prompt).toMatchObject({ id: 'moves', focus: 'moves', waitsForNudge: true })
    wait(t, 1000)
    expect(t.dismiss()).toBe(false)
    expect(t.blocking).toBe(true)
    t.noteNudges(1)
    expect(t.blocking).toBe(false)

    // 3. After the Pokémon has chosen (followed the nudge): explains the ♪.
    t.update(input({ timeMs: 3000, nudgesUsed: 1 }), [])
    expect(t.prompt).toBeNull()
    t.update(input({ timeMs: 3400, nudgesUsed: 1 }), [chosen(true)])
    expect(t.prompt).toMatchObject({ id: 'afterNudge', focus: 'emote' })
    expect(t.prompt!.lines[0]).toContain('♪')
    wait(t, TUTORIAL_LOCK_MS + 20)
    t.dismiss()

    // 4. The dots.
    t.update(input({ timeMs: 3600, nudgesUsed: 1 }), [])
    expect(t.prompt).toMatchObject({ id: 'pips', focus: 'pips' })
    wait(t, TUTORIAL_LOCK_MS + 20)
    t.dismiss()
    expect(t.finished).toBe(true)
    expect(t.shown).toEqual(['atb', 'moves', 'afterNudge', 'pips'])
    // Nothing more after that.
    t.update(input({ timeMs: 9000, atb: 1 }), [chosen(false)])
    expect(t.prompt).toBeNull()
  })

  it('explains "…" when the Pokémon did not follow the nudge', () => {
    const t = new Tutorial()
    t.update(input({ timeMs: 0 }), [])
    t.update(input({ timeMs: ATB_PROMPT_DELAY_MS + 16 }), [])
    wait(t, 300)
    t.dismiss()
    t.update(input({ timeMs: 2000, atb: 0.5 }), [])
    t.noteNudges(1)
    t.update(input({ timeMs: 3000, nudgesUsed: 1 }), [chosen(false)])
    expect(t.prompt!.lines[0]).toContain('…')
  })

  it('does not let a double press skip a prompt', () => {
    const t = new Tutorial()
    t.update(input({ timeMs: 0 }), [])
    t.update(input({ timeMs: ATB_PROMPT_DELAY_MS + 16 }), [])
    expect(t.dismiss()).toBe(false) // the lock after the prompt opened
    wait(t, TUTORIAL_LOCK_MS + 20)
    expect(t.dismiss()).toBe(true)
  })

  it('waits until both Pokémon are out, and can be skipped or disabled', () => {
    const t = new Tutorial()
    t.update(input({ timeMs: 5000, ready: false }), [])
    expect(t.prompt).toBeNull()
    t.skip()
    t.update(input({ timeMs: 9000, atb: 1 }), [])
    expect(t.prompt).toBeNull()
    expect(t.finished).toBe(true)
    const off = new Tutorial({ enabled: false })
    off.update(input({ timeMs: 9000, atb: 1 }), [])
    expect(off.prompt).toBeNull()
  })

  it('goes on after "try a move" if the player had already nudged before the prompt', () => {
    const t = new Tutorial()
    t.update(input({ timeMs: 0 }), [])
    t.update(input({ timeMs: ATB_PROMPT_DELAY_MS + 16 }), [])
    wait(t, 300)
    t.dismiss()
    t.update(input({ timeMs: 1500, atb: 0.1, nudgesUsed: 1 }), [])
    expect(t.prompt).toBeNull()
    t.update(input({ timeMs: 2500, nudgesUsed: 1 }), [chosen(true)])
    expect(t.prompt?.id).toBe('afterNudge')
  })
})
