import { describe, expect, it } from 'vitest'
import { BATTLE_THEMES, themeForMap } from '../game/battleThemes'
import { MAPS } from '../game/maps'

describe('battle backdrops', () => {
  it('picks a themed backdrop per place', () => {
    expect(themeForMap('route1')).toBe('meadow')
    expect(themeForMap('skogen')).toBe('forest')
    expect(themeForMap('hemstad')).toBe('town')
    expect(themeForMap('gruss')).toBe('town')
    expect(themeForMap('gruss_gym')).toBe('gym')
    expect(themeForMap('gruss_center')).toBe('indoor')
    expect(themeForMap('nowhere')).toBe('meadow')
  })

  it('every map has a known theme and all five themes are used by the game', () => {
    const used = new Set(Object.keys(MAPS).map(themeForMap))
    for (const theme of used) expect(BATTLE_THEMES).toContain(theme)
    expect([...used].sort()).toEqual([...BATTLE_THEMES].sort())
  })
})
