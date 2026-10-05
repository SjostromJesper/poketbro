import { describe, expect, it } from 'vitest'
import { applyAndNarrate, statChanges, statsAtLevel, type SequenceStep } from '../game/postBattle'
import { learnMove } from '../engine/progression'
import { xpForLevel } from '../engine/formulas'
import { speciesOf, statsOf } from '../engine/pokemon'
import type { BattleOutcome, OwnedPokemon, PartyUpdate } from '../engine/types'
import { BALANCE, data, mon } from './helpers'

function outcomeFor(p: OwnedPokemon, xp: number, patch: Partial<PartyUpdate> = {}): BattleOutcome {
  const update: PartyUpdate = {
    uid: p.uid, currentHp: p.currentHp, status: null, heldItem: null, fainted: false, participated: true,
    moves: p.moves, movesUsed: {}, nudgedMoves: {}, followedNudge: false, trait: p.trait, ...patch,
  }
  return { result: 'win', xp: { [p.uid]: xp }, defeated: [], caught: null, party: [update] }
}

const ofType = <T extends SequenceStep['type']>(steps: SequenceStep[], type: T) => steps.filter((s): s is Extract<SequenceStep, { type: T }> => s.type === type)
const growth = (p: OwnedPokemon) => speciesOf(data, p).growthRate
const xpTo = (p: OwnedPokemon, level: number) => xpForLevel(data.growthRates, growth(p), level) - p.xp

describe('post-battle sequence', () => {
  it('a small XP gain is one message with a filling bar and no level-up', () => {
    const p = mon('charmander', 12, { moves: ['scratch', 'ember'] })
    const { steps, application } = applyAndNarrate(data, BALANCE, [p], outcomeFor(p, 20))
    expect(application.levelUps).toHaveLength(0)
    const message = steps[0]
    expect(message).toMatchObject({ type: 'message', lines: ['Charmander fick 20 XP!'] })
    if (message.type !== 'message' || !message.bar) throw new Error('expected a bar')
    expect(message.bar.from).toBeLessThan(message.bar.to)
    expect(message.bar.to).toBeLessThan(100)
    expect(ofType(steps, 'levelUp')).toHaveLength(0)
  })

  it('a big XP gain gives one level-up panel per level, in order, with matching bars', () => {
    const p = mon('charmander', 12, { moves: ['scratch', 'ember'] })
    const startLevel = p.level
    const { steps } = applyAndNarrate(data, BALANCE, [p], outcomeFor(p, xpTo(p, startLevel + 3) + 1))
    expect(p.level).toBe(startLevel + 3)
    const panels = ofType(steps, 'levelUp')
    expect(panels.map(s => s.level)).toEqual([startLevel + 1, startLevel + 2, startLevel + 3])
    // bars: the first message fills to 100, each level-up is followed by a bar that restarts at 0, only the last one stops short
    const bars = ofType(steps, 'xpBar')
    expect(bars).toHaveLength(3)
    expect(bars.map(b => b.bar.from)).toEqual([0, 0, 0])
    expect(bars.map(b => b.bar.to).slice(0, 2)).toEqual([100, 100])
    expect(bars[2].bar.to).toBeLessThan(100)
    // the "reached level" message comes before its panel and plays the jingle
    const idx = steps.findIndex(s => s.type === 'levelUp')
    expect(steps[idx - 1]).toMatchObject({ type: 'message', lines: [`Charmander nådde nivå ${startLevel + 1}!`], jingle: 'levelUp' })
  })

  it('stat changes equal the stat formula at the two levels', () => {
    const p = mon('charmander', 12, { moves: ['scratch'] })
    const changes = statChanges(data, p, 12, 13)
    const a = statsAtLevel(data, p, 12)
    const b = statsAtLevel(data, p, 13)
    for (const c of changes) {
      expect(c.before).toBe(a[c.stat])
      expect(c.after).toBe(b[c.stat])
      expect(c.delta).toBe(b[c.stat] - a[c.stat])
    }
    expect(changes.find(c => c.stat === 'hp')!.delta).toBeGreaterThan(0)
    // the numbers after the whole sequence equal what the Pokémon has now
    const q = mon('charmander', 12, { moves: ['scratch'] })
    const { steps } = applyAndNarrate(data, BALANCE, [q], outcomeFor(q, xpTo(q, 14) + 1))
    const last = ofType(steps, 'levelUp').at(-1)!
    const now = statsOf(data, q)
    for (const c of last.changes) expect(c.after).toBe(now[c.stat])
  })

  it('learns a move automatically at the right level when there is a free slot', () => {
    const p = mon('charmander', 12, { moves: ['scratch', 'growl'] })
    const entry = speciesOf(data, p).levelUpMoves.find(e => e.level > p.level && data.moves[e.move])!
    const { steps } = applyAndNarrate(data, BALANCE, [p], outcomeFor(p, xpTo(p, entry.level)))
    const name = data.moves[entry.move].displayName
    expect(steps.some(s => s.type === 'message' && s.lines[0] === `Charmander lärde sig ${name}!`)).toBe(true)
    expect(p.moves.some(m => m.move === entry.move)).toBe(true)
    expect(ofType(steps, 'moveReplace')).toHaveLength(0)
  })

  it('asks which move to forget when all four slots are used, and replacing keeps the PP rules', () => {
    const p = mon('charmander', 12, { moves: ['scratch', 'growl', 'tackle', 'ember'] })
    const entry = speciesOf(data, p).levelUpMoves.find(e => e.level > p.level && data.moves[e.move] && !p.moves.some(m => m.move === e.move))!
    p.moves[0].pp = 3
    p.habits.growl = 8
    const { steps } = applyAndNarrate(data, BALANCE, [p], outcomeFor(p, xpTo(p, entry.level), { moves: p.moves }))
    const replace = ofType(steps, 'moveReplace')
    expect(replace).toHaveLength(1)
    expect(replace[0].move).toBe(entry.move)
    const at = steps.indexOf(replace[0])
    expect(steps[at - 1]).toMatchObject({ type: 'message' })
    expect(JSON.stringify(steps[at - 1])).toContain('kan bara ha 4 moves')
    // nothing changed yet: the choice is applied on confirmation
    expect(p.moves.map(m => m.move)).toEqual(['scratch', 'growl', 'tackle', 'ember'])
    learnMove(data, p, entry.move, 1, BALANCE)
    expect(p.moves.map(m => m.move)).toEqual(['scratch', entry.move, 'tackle', 'ember'])
    // the new move starts with full PP, the others keep theirs, the forgotten move's habit is gone
    expect(p.moves[1].pp).toBe(data.moves[entry.move].pp)
    expect(p.moves[0].pp).toBe(3)
    expect(p.habits.growl).toBeUndefined()
  })

  it('reports a new favorite as a step after the level-ups', () => {
    const p = mon('charmander', 12, { moves: ['scratch', 'ember'], trait: 'calm', trust: 160 })
    p.habits.ember = 25
    const { steps } = applyAndNarrate(data, BALANCE, [p], outcomeFor(p, 10, { movesUsed: { ember: 3 } }))
    expect(ofType(steps, 'favorite')).toEqual([{ type: 'favorite', uid: p.uid, move: 'ember', previous: undefined }])
  })

  it('applies the result at once (atomic): level and XP are updated when the steps are built', () => {
    const p = mon('charmander', 12, { moves: ['scratch'] })
    const xp = p.xp
    applyAndNarrate(data, BALANCE, [p], outcomeFor(p, 100))
    expect(p.xp).toBe(xp + 100)
  })

  it('gives no XP lines to Pokémon that did not take part', () => {
    const p = mon('charmander', 12, { moves: ['scratch'] })
    const { steps } = applyAndNarrate(data, BALANCE, [p], outcomeFor(p, 0, { participated: false }))
    expect(steps).toHaveLength(0)
  })
})
