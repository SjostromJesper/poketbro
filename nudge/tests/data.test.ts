import { describe, expect, it } from 'vitest'
import { gameData, TYPE_NAMES } from '../data'

describe('generated PokeAPI data (M1)', () => {
  it('has all 151 species with consistent shape', () => {
    expect(Object.keys(gameData.species)).toHaveLength(151)
    for (let id = 1; id <= 151; id++) {
      const s = gameData.species[id]
      expect(s.id).toBe(id)
      expect(s.types.length).toBeGreaterThan(0)
      expect(s.baseStats.hp).toBeGreaterThan(0)
      expect(s.sprites.front).toMatch(/^https:\/\//)
      expect(s.sprites.back).toMatch(/^https:\/\//)
      expect(s.captureRate).toBeGreaterThan(0)
      expect(gameData.growthRates[s.growthRate]).toBeDefined()
    }
  })

  it('gives Bulbasaur the FireRed/LeafGreen level-up learnset', () => {
    const bulbasaur = gameData.species[1]
    expect(bulbasaur.name).toBe('bulbasaur')
    expect(bulbasaur.types).toEqual(['grass', 'poison'])
    expect(bulbasaur.baseStats).toEqual({ hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 })
    expect(bulbasaur.levelUpMoves).toEqual([
      { level: 1, move: 'tackle' },
      { level: 4, move: 'growl' },
      { level: 7, move: 'leech-seed' },
      { level: 10, move: 'vine-whip' },
      { level: 15, move: 'poison-powder' },
      { level: 15, move: 'sleep-powder' },
      { level: 20, move: 'razor-leaf' },
      { level: 25, move: 'sweet-scent' },
      { level: 32, move: 'growth' },
      { level: 39, move: 'synthesis' },
      { level: 46, move: 'solar-beam' },
    ])
    expect(bulbasaur.evolutions).toEqual([{ to: 2, minLevel: 16 }])
  })

  it('knows every move referenced by a learnset', () => {
    for (const s of Object.values(gameData.species)) {
      for (const entry of s.levelUpMoves) expect(gameData.moves[entry.move], `${s.name}: ${entry.move}`).toBeDefined()
      for (const move of s.tmMoves) expect(gameData.moves[move], `${s.name}: ${move}`).toBeDefined()
    }
  })

  it('has a correct 18-type chart', () => {
    expect(Object.keys(gameData.typeChart).sort()).toEqual([...TYPE_NAMES].sort())
    const chart = gameData.typeChart
    expect(chart.fire.grass).toBe(2)
    expect(chart.water.fire).toBe(2)
    expect(chart.grass.water).toBe(2)
    expect(chart.fire.water).toBe(0.5)
    expect(chart.electric.ground).toBe(0)
    expect(chart.normal.ghost).toBe(0)
    expect(chart.ghost.normal).toBe(0)
    expect(chart.ground.flying).toBe(0)
    expect(chart.dragon.fairy).toBe(0)
    expect(chart.rock.fire).toBe(2)
    expect(chart.fighting.normal).toBe(2)
    expect(chart.normal.fire).toBeUndefined()
  })

  it('has all 25 natures with the right stat effects', () => {
    const natures = Object.values(gameData.natures)
    expect(natures).toHaveLength(25)
    expect(natures.filter(n => n.increased === null && n.decreased === null)).toHaveLength(5)
    expect(gameData.natures.adamant).toMatchObject({ increased: 'attack', decreased: 'spAttack' })
    expect(gameData.natures.timid).toMatchObject({ increased: 'speed', decreased: 'attack' })
    expect(gameData.natures.bold).toMatchObject({ increased: 'defense', decreased: 'attack' })
  })

  it('has XP curves for all six growth rates', () => {
    expect(Object.keys(gameData.growthRates)).toHaveLength(6)
    expect(gameData.growthRates['medium-slow'][100]).toBe(1059860)
    expect(gameData.growthRates.fast[100]).toBe(800000)
    expect(gameData.growthRates.slow[100]).toBe(1250000)
    expect(gameData.growthRates.medium[100]).toBe(1000000)
    for (const table of Object.values(gameData.growthRates)) {
      expect(table).toHaveLength(101)
      for (let level = 2; level <= 100; level++) expect(table[level]).toBeGreaterThanOrEqual(table[level - 1])
    }
  })

  it('has the MVP-relevant moves and TM compatibility', () => {
    expect(gameData.moves.ember).toMatchObject({ type: 'fire', power: 40, damageClass: 'special', ailment: 'burn' })
    expect(gameData.moves['swords-dance'].statChanges).toEqual([{ stat: 'attack', change: 2 }])
    expect(gameData.moves['rock-tomb']).toMatchObject({ type: 'rock', power: 60 })
    expect(gameData.species[74].tmMoves).toContain('rock-tomb') // Geodude
    expect(gameData.species[95].name).toBe('onix')
  })

  it('has the items the game uses', () => {
    for (const name of ['poke-ball', 'potion', 'antidote', 'paralyze-heal', 'oran-berry', 'quick-claw', 'silk-scarf', 'charcoal', 'mystic-water', 'leftovers']) {
      expect(gameData.items[name], name).toBeDefined()
      expect(gameData.items[name].sprite).toMatch(/^https:\/\//)
    }
  })
})
