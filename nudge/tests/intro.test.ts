import { describe, expect, it } from 'vitest'
import { CutsceneRunner, PRESS_LOCK_MS } from '../game/cutscene'
import { currentNames, fillNames, setNames } from '../game/names'
import { introSteps, MAX_NAME_LENGTH, NAME_SUGGESTIONS } from '../game/text/intro'

function read(c: CutsceneRunner) {
  for (let t = 0; t < 6000; t += 16) c.update(16)
  c.press()
  for (let t = 0; t < PRESS_LOCK_MS + 20; t += 16) c.update(16)
}

/** Plays the intro like a player: reads every line and answers the questions with `answers`. */
function playIntro(lookCount: number, answers: { player: string, playerOk?: string, look?: number, rival: string, rivalFirst?: string }) {
  const c = new CutsceneRunner(introSteps({ lookCount }))
  const seenText: string[] = []
  const asked: string[] = []
  c.start()
  for (let guard = 0; guard < 400 && !c.finished; guard++) {
    for (let t = 0; t < 40; t += 16) c.update(16)
    const prompt = c.state.prompt
    if (prompt) {
      for (let t = 0; t < PRESS_LOCK_MS + 20; t += 16) c.update(16)
      asked.push(`${prompt.kind}:${prompt.name}`)
      if (prompt.kind === 'input') {
        if (prompt.name === 'rival' && answers.rivalFirst && !asked.includes('rival-retry')) {
          asked.push('rival-retry')
          c.answer(answers.rivalFirst)
        } else c.answer(prompt.name === 'player' ? answers.player : answers.rival)
      } else if (prompt.name === 'look') c.answer(answers.look ?? 0)
      else if (prompt.name === 'playerOk' && answers.playerOk) {
        c.answer(answers.playerOk)
        answers.playerOk = undefined
      } else if (prompt.name === 'rivalOk' && answers.rivalFirst && asked.filter(a => a === 'choice:rivalOk').length === 1) c.answer('Nej')
      else c.answer('Ja')
    } else if (c.state.text) {
      seenText.push(...c.state.text.lines)
      read(c)
    }
  }
  return { c, seenText, asked }
}

describe('the intro', () => {
  it('plays through, asks for the name, the look and the rival, and ends with the three results', () => {
    const { c, seenText, asked } = playIntro(2, { player: 'Maja', look: 1, rival: 'Noa' })
    expect(c.finished).toBe(true)
    expect(c.vars).toMatchObject({ player: 'Maja', rival: 'Noa', playerSprite: 'player2' })
    expect(asked).toEqual(['input:player', 'choice:playerOk', 'choice:look', 'input:rival', 'choice:rivalOk'])
    expect(seenText.join(' ')).toContain('Jag heter Ek')
    expect(seenText.join(' ')).toContain('Maja! Din alldeles egen Pokémonresa ska just börja.')
    expect(seenText.join(' ')).toContain('Noa')
  })

  it('explains the differences (they decide for themselves, you can encourage, do not shout too often, trust)', () => {
    const { seenText } = playIntro(2, { player: 'Maja', rival: 'Noa' })
    const text = seenText.join(' ')
    expect(text).toContain('Pokémon är inga verktyg')
    expect(text).toContain('Snabba Pokémon hinner agera oftare')
    expect(text).toContain('uppmuntra')
    expect(text).toContain('ropa inte för ofta')
    expect(text).toContain('litar')
  })

  it('asks again after "Nej" on the confirmation', () => {
    const { c, asked } = playIntro(2, { player: 'Olle', playerOk: 'Nej', rival: 'Max' })
    expect(asked.slice(0, 4)).toEqual(['input:player', 'choice:playerOk', 'input:player', 'choice:playerOk'])
    expect(c.vars.player).toBe('Olle')
  })

  it('skips the look step when the theme has only one player look', () => {
    const { c, asked } = playIntro(1, { player: 'Lo', rival: 'Max' })
    expect(asked).not.toContain('choice:look')
    expect(c.vars.playerSprite).toBe('player')
  })

  it('offers three name suggestions of at most ten characters', () => {
    expect(NAME_SUGGESTIONS).toHaveLength(3)
    for (const name of NAME_SUGGESTIONS) expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH)
    const c = new CutsceneRunner(introSteps({ lookCount: 2 }))
    c.start()
    for (let guard = 0; guard < 40 && !c.state.prompt; guard++) read(c)
    expect(c.state.prompt).toMatchObject({ kind: 'input', maxLength: 10, suggestions: NAME_SUGGESTIONS })
  })
})

describe('names in text', () => {
  it('fills {player} and {rival} and leaves everything else alone', () => {
    setNames('Maja', 'Noa')
    expect(fillNames('Hej {player}, {rival} väntar! {annat}')).toBe('Hej Maja, Noa väntar! {annat}')
    expect(currentNames()).toEqual({ player: 'Maja', rival: 'Noa' })
    setNames('', '')
    expect(fillNames('{player} och {rival}')).toBe('Du och Elias')
  })
})
