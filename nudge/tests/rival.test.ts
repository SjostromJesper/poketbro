import { describe, expect, it } from 'vitest'
import { rivalStarter, rivalTeam, STARTER_IDS } from '../game/rival'
import { typeEffectiveness } from '../engine/formulas'
import { data } from './helpers'

describe('the rival', () => {
  it('picks the starter with the type advantage over the player\'s', () => {
    for (const player of STARTER_IDS) {
      const rival = rivalStarter(player)
      const attack = data.species[rival].types[0]
      expect(typeEffectiveness(attack, data.species[player].types, data.typeChart), `${data.species[rival].name} vs ${data.species[player].name}`).toBeGreaterThan(1)
    }
  })

  it('has a team that follows the level curve, three times', () => {
    for (const player of STARTER_IDS) {
      let last = 0
      for (const round of [1, 2, 3] as const) {
        const team = rivalTeam(round, player)
        const top = Math.max(...team.map(m => m.level))
        expect(top).toBeGreaterThan(last)
        last = top
        for (const m of team) expect(data.species[m.speciesId], `species ${m.speciesId}`).toBeDefined()
        expect(team.some(m => [rivalStarter(player), rivalStarter(player) + 1].includes(m.speciesId))).toBe(true)
      }
    }
  })
})
