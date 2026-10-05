import { describe, expect, it } from 'vitest'
import { applyBattleOutcome, evolvePokemon, grantXp, healPokemon, learnMove, movesLearnedAtLevel, pendingEvolution, stoneEvolution } from '../engine/progression'
import { createPokemon, maxHpOf, statsOf } from '../engine/pokemon'
import { createWildPokemon, createTrainerPokemon } from '../engine/ai'
import { createRng } from '../engine/rng'
import { xpForLevel } from '../engine/formulas'
import type { BattleOutcome, PartyUpdate } from '../engine/types'
import { BALANCE, data, mon, speciesId } from './helpers'

function update(uid: string, patch: Partial<PartyUpdate> = {}): PartyUpdate {
  return { uid, currentHp: 10, status: null, moves: [], heldItem: null, fainted: false, participated: true, movesUsed: {}, nudgedMoves: {}, followedNudge: false, trait: 'loyal', ...patch }
}
function outcome(updates: PartyUpdate[], xp: Record<string, number> = {}, result: BattleOutcome['result'] = 'win'): BattleOutcome {
  return { result, party: updates, xp, defeated: [], caught: null }
}

describe('creating Pokémon', () => {
  it('gives wild Pokémon the latest learnset moves for their level', () => {
    const bulbasaur = createWildPokemon({ data, balance: BALANCE, rng: createRng(1), speciesId: 1, level: 16 })
    // The four most recent level-up moves at level 16.
    expect(bulbasaur.moves.map(m => m.move)).toEqual(['leech-seed', 'vine-whip', 'poison-powder', 'sleep-powder'])
    expect(bulbasaur.moves.every(m => m.pp === data.moves[m.move].pp && m.maxPp === m.pp)).toBe(true)
    expect(bulbasaur.trust).toBe(BALANCE.TRUST_START_WILD)
    expect(bulbasaur.xp).toBe(xpForLevel(data.growthRates, 'medium-slow', 16))
    expect(bulbasaur.currentHp).toBe(maxHpOf(data, bulbasaur))
    const low = createWildPokemon({ data, balance: BALANCE, rng: createRng(1), speciesId: 1, level: 3 })
    expect(low.moves.map(m => m.move)).toEqual(['tackle'])
    const trainer = createTrainerPokemon({ data, balance: BALANCE, rng: createRng(2), speciesId: 74, level: 10, trainerName: 'Brock' })
    expect(trainer.trust).toBe(BALANCE.TRUST_START_TRAINER)
    expect(trainer.originalTrainer).toBe('Brock')
  })

  it('draws IVs, nature and trait randomly but reproducibly', () => {
    const a = createWildPokemon({ data, balance: BALANCE, rng: createRng(5), speciesId: 25, level: 5 })
    const b = createWildPokemon({ data, balance: BALANCE, rng: createRng(5), speciesId: 25, level: 5 })
    expect(a).toEqual(b)
    expect(Object.values(a.ivs).every(iv => iv >= 0 && iv <= 31)).toBe(true)
    expect(Object.keys(data.natures)).toContain(a.nature)
    const traits = new Set<string>()
    for (let seed = 0; seed < 200; seed++) traits.add(createWildPokemon({ data, balance: BALANCE, rng: createRng(seed), speciesId: 25, level: 5 }).trait)
    expect(traits.size).toBe(7)
  })
})

describe('levelling up', () => {
  it('learns level-up moves automatically when there is room', () => {
    const bulbasaur = mon('bulbasaur', 6, { moves: ['tackle', 'growl'] })
    expect(movesLearnedAtLevel(data, bulbasaur, 7)).toEqual(['leech-seed'])
    const info = grantXp(data, BALANCE, bulbasaur, xpForLevel(data.growthRates, 'medium-slow', 7) - bulbasaur.xp)!
    expect(info).toMatchObject({ from: 6, to: 7, learned: ['leech-seed'], pendingMoves: [], evolveTo: null })
    expect(bulbasaur.level).toBe(7)
    expect(bulbasaur.moves.map(m => m.move)).toEqual(['tackle', 'growl', 'leech-seed'])
  })

  it('queues moves for the replace dialog when all four slots are full', () => {
    const bulbasaur = mon('bulbasaur', 9, { moves: ['tackle', 'growl', 'leech-seed', 'splash'] })
    const info = grantXp(data, BALANCE, bulbasaur, xpForLevel(data.growthRates, 'medium-slow', 10) - bulbasaur.xp)!
    expect(info.pendingMoves).toEqual(['vine-whip'])
    expect(bulbasaur.moves).toHaveLength(4)
    learnMove(data, bulbasaur, 'vine-whip', 3, BALANCE)
    expect(bulbasaur.moves.map(m => m.move)).toEqual(['tackle', 'growl', 'leech-seed', 'vine-whip'])
  })

  it('forgetting a move forgets its habit', () => {
    const bulbasaur = mon('bulbasaur', 9, { moves: ['tackle', 'growl', 'leech-seed', 'splash'] })
    bulbasaur.habits.splash = 7
    learnMove(data, bulbasaur, 'vine-whip', 3, BALANCE)
    expect(bulbasaur.habits.splash).toBeUndefined()
  })

  it('handles several levels at once, raises max HP and adds trust per level', () => {
    const bulbasaur = mon('bulbasaur', 5, { trust: 100 })
    const before = maxHpOf(data, bulbasaur)
    const hpBefore = bulbasaur.currentHp
    const info = grantXp(data, BALANCE, bulbasaur, xpForLevel(data.growthRates, 'medium-slow', 10) - bulbasaur.xp)!
    expect(info.to).toBe(10)
    expect(bulbasaur.trust).toBe(100 + 5 * BALANCE.TRUST_LEVEL_UP)
    expect(maxHpOf(data, bulbasaur)).toBeGreaterThan(before)
    expect(bulbasaur.currentHp).toBe(hpBefore + (maxHpOf(data, bulbasaur) - before))
    expect(info.learned).toContain('leech-seed')
    expect(info.learned).toContain('vine-whip')
  })

  it('flags level-based evolutions and keeps the HP ratio when evolving', () => {
    const bulbasaur = mon('bulbasaur', 15)
    const info = grantXp(data, BALANCE, bulbasaur, xpForLevel(data.growthRates, 'medium-slow', 16) - bulbasaur.xp)!
    expect(info.evolveTo).toBe(2)
    expect(pendingEvolution(data, bulbasaur, BALANCE)).toBe(2)
    const oldMax = maxHpOf(data, bulbasaur)
    evolvePokemon(data, bulbasaur, 2)
    expect(bulbasaur.speciesId).toBe(2)
    expect(maxHpOf(data, bulbasaur)).toBeGreaterThan(oldMax)
    expect(bulbasaur.currentHp).toBe(maxHpOf(data, bulbasaur))
    expect(pendingEvolution(data, mon('ivysaur', 20), BALANCE)).toBeNull()
    expect(pendingEvolution(data, mon('pikachu', 50), BALANCE)).toBeNull() // stone evolution: see stoneEvolution
  })

  it('stops at the level cap', () => {
    const maxed = mon('bulbasaur', 100)
    expect(grantXp(data, BALANCE, maxed, 1_000_000)).toBeNull()
    expect(statsOf(data, maxed).hp).toBeGreaterThan(0)
  })
})

describe('applying a battle outcome', () => {
  it('updates HP, PP, status and the held item, and gives habits + trust for a win', () => {
    const p = mon('charmander', 10, { moves: ['scratch', 'ember', 'growl'], heldItem: 'oran-berry', trust: 100 })
    p.habits.ember = 2
    const moves = p.moves.map(m => ({ ...m }))
    moves[1].pp -= 3
    const result = applyBattleOutcome(data, BALANCE, [p], outcome([
      update(p.uid, { currentHp: 7, status: 'burn', moves, heldItem: null, movesUsed: { ember: 3, scratch: 9, struggle: 2, 'not-a-move': 4 } }),
    ]))
    expect(result.levelUps).toEqual([])
    expect(p.currentHp).toBe(7)
    expect(p.status).toBe('burn')
    expect(p.moves[1].pp).toBe(moves[1].pp)
    expect(p.heldItem).toBeUndefined()
    expect(p.habits.ember).toBe(2 + 3)
    expect(p.habits.scratch).toBe(BALANCE.HABIT_GAIN_CAP_PER_BATTLE)
    expect(p.habits.struggle).toBeUndefined()
    expect(p.habits['not-a-move']).toBeUndefined()
    expect(p.trust).toBe(100 + BALANCE.TRUST_WIN)
  })

  it('gives no habits or win-trust for losses, a trust penalty for fainting, and nothing to bystanders', () => {
    const fainted = mon('charmander', 10, { trust: 100 })
    const bystander = mon('pidgey', 10, { trust: 100 })
    applyBattleOutcome(data, BALANCE, [fainted, bystander], outcome([
      update(fainted.uid, { fainted: true, currentHp: 0, movesUsed: { scratch: 4 } }),
      update(bystander.uid, { participated: false, movesUsed: {} }),
    ], {}, 'lose'))
    expect(fainted.trust).toBe(100 + BALANCE.TRUST_FAINT)
    expect(fainted.habits).toEqual({})
    expect(bystander.trust).toBe(100)
    const winner = mon('charmander', 10, { trust: 100 })
    const dead = mon('pidgey', 10, { trust: 100 })
    applyBattleOutcome(data, BALANCE, [winner, dead], outcome([
      update(winner.uid), update(dead.uid, { fainted: true, currentHp: 0 }),
    ]))
    expect(winner.trust).toBe(100 + BALANCE.TRUST_WIN)
    expect(dead.trust).toBe(100 + BALANCE.TRUST_FAINT)
  })

  it('rewards trust for a nudge that was followed in a win, double for proud Pokémon', () => {
    const a = mon('charmander', 10, { trust: 100, trait: 'loyal' })
    const b = mon('pidgey', 10, { trust: 100, trait: 'proud' })
    applyBattleOutcome(data, BALANCE, [a, b], outcome([
      update(a.uid, { followedNudge: true, trait: 'loyal' }), update(b.uid, { followedNudge: true, trait: 'proud' }),
    ]))
    expect(a.trust).toBe(100 + BALANCE.TRUST_WIN + BALANCE.TRUST_NUDGE_WIN)
    expect(b.trust).toBe(100 + BALANCE.TRUST_WIN + 2 * BALANCE.TRUST_NUDGE_WIN)
  })

  it('applies XP and reports level-ups; trust is clamped to 0..255', () => {
    const p = mon('bulbasaur', 6, { moves: ['tackle', 'growl'], trust: 254 })
    const needed = xpForLevel(data.growthRates, 'medium-slow', 7) - p.xp
    const result = applyBattleOutcome(data, BALANCE, [p], outcome([update(p.uid, { moves: p.moves })], { [p.uid]: needed }))
    expect(result.levelUps).toHaveLength(1)
    expect(result.levelUps[0].learned).toEqual(['leech-seed'])
    expect(p.trust).toBe(255)
    const low = mon('bulbasaur', 6, { trust: 2 })
    applyBattleOutcome(data, BALANCE, [low], outcome([update(low.uid, { fainted: true, currentHp: 0 })], {}, 'lose'))
    expect(low.trust).toBe(0)
  })

  it('heals at the Pokémon Center: HP, status, PP and a bit of trust', () => {
    const p = mon('charmander', 10, { trust: 100 })
    p.currentHp = 1
    p.status = 'poison'
    p.moves[0].pp = 0
    healPokemon(data, BALANCE, p)
    expect(p.currentHp).toBe(maxHpOf(data, p))
    expect(p.status).toBeUndefined()
    expect(p.moves[0].pp).toBe(p.moves[0].maxPp)
    expect(p.trust).toBe(100 + BALANCE.TRUST_CENTER)
    expect(speciesId('charmander')).toBe(4)
    expect(createPokemon).toBeTypeOf('function')
  })
})

describe('evolution stones and trade evolutions', () => {
  it('stones evolve the right species and do nothing to others', () => {
    expect(stoneEvolution(data, mon('pikachu', 5), 'thunder-stone')).toBe(26)
    expect(stoneEvolution(data, mon('pikachu', 5), 'fire-stone')).toBeNull()
    expect(stoneEvolution(data, mon('eevee', 5), 'water-stone')).toBe(134)
    expect(stoneEvolution(data, mon('eevee', 5), 'fire-stone')).toBe(136)
    expect(stoneEvolution(data, mon('charmander', 50), 'fire-stone')).toBeNull()
    expect(stoneEvolution(data, mon('nidorino', 5), 'moon-stone')).toBe(34)
  })

  it('trade evolutions (Kadabra, Machoke, Graveler, Haunter) evolve at the balance level', () => {
    const L = BALANCE.TRADE_EVOLUTION_LEVEL
    expect(L).toBe(38)
    for (const [name, to] of [['kadabra', 65], ['machoke', 68], ['graveler', 76], ['haunter', 94]] as const) {
      expect(pendingEvolution(data, mon(name, L - 1), BALANCE), name).toBeNull()
      expect(pendingEvolution(data, mon(name, L), BALANCE), name).toBe(to)
    }
  })

  it('stone evolutions never trigger on level-up', () => {
    expect(pendingEvolution(data, mon('pikachu', 90), BALANCE)).toBeNull()
    expect(pendingEvolution(data, mon('eevee', 90), BALANCE)).toBeNull()
  })
})
