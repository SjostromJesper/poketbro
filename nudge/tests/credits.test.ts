import { describe, expect, it } from 'vitest'
import { CREDITS } from '../game/credits'

describe('credits', () => {
  const text = JSON.stringify(CREDITS)

  it('credits every source the game uses', () => {
    expect(text).toContain('pixel-boy')
    expect(text).toContain('Ninja Adventure')
    expect(text).toContain('Juhani Junkala')
    expect(text).toContain('PokéAPI')
  })

  it('does not credit assets that are not used (Kenney Tiny Town was downloaded but is not in the game)', () => {
    expect(text).not.toContain('Kenney')
  })

  it('gives every entry a link and a licence line', () => {
    for (const entry of CREDITS) {
      expect(entry.url).toMatch(/^https:\/\//)
      expect(entry.license.length).toBeGreaterThan(2)
    }
  })
})
