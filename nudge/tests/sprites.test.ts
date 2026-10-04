import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAPS } from '../game/maps'
import { CHARACTERS, faceUrl, LOOK_SPRITE, PLAYER_SPRITE, sheetUrl, spriteFor, spriteFrame, type SpriteId } from '../game/sprites'
import { TRAINERS } from '../game/trainers'

const PUBLIC = join(__dirname, '..', '..', 'public')
const ids = Object.keys(CHARACTERS) as SpriteId[]

function pngSize(file: string): { w: number, h: number } {
  const buf = readFileSync(file)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

describe('character sprites', () => {
  it('every sprite has a sheet (4 directions x enough frames) and a 38x38 face', () => {
    for (const id of ids) {
      const sheet = join(PUBLIC, sheetUrl(id))
      const face = join(PUBLIC, faceUrl(id))
      expect(existsSync(sheet), id).toBe(true)
      expect(existsSync(face), id).toBe(true)
      const { w, h } = pngSize(sheet)
      expect(w, id).toBe(64)
      expect(h / 16, id).toBeGreaterThanOrEqual(CHARACTERS[id].frames)
      expect(pngSize(face), id).toEqual({ w: 38, h: 38 })
    }
  })

  it('walk animation: standing shows the first frame, a step cycles through all frames, columns follow the facing', () => {
    expect(spriteFrame('Boy', 'down', -1)).toEqual({ col: 0, row: 0 })
    expect(spriteFrame('Boy', 'up', -1)).toEqual({ col: 1, row: 0 })
    expect(spriteFrame('Boy', 'left', -1)).toEqual({ col: 2, row: 0 })
    expect(spriteFrame('Boy', 'right', -1)).toEqual({ col: 3, row: 0 })
    const rows = [0, 0.26, 0.51, 0.76, 0.999].map(p => spriteFrame('Boy', 'down', p).row)
    expect(rows).toEqual([0, 1, 2, 3, 3])
    // small sheets only have two frames
    expect([0, 0.3, 0.6, 0.99].map(p => spriteFrame('Child', 'down', p).row)).toEqual([0, 0, 1, 1])
  })

  it('every NPC look and every trainer resolves to a sprite (the PC is an object)', () => {
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs) {
        const sprite = spriteFor(npc)
        if (npc.look === 'pc') expect(sprite).toBeNull()
        else expect(ids, `${map.id} ${npc.id}`).toContain(sprite)
      }
    }
    for (const trainer of Object.values(TRAINERS)) expect(ids, trainer.id).toContain(spriteFor(trainer))
    for (const sprite of Object.values(LOOK_SPRITE)) expect(ids).toContain(sprite)
    expect(ids).toContain(PLAYER_SPRITE)
  })

  it('the gym leader looks different from everyone else and has an explicit sprite', () => {
    const leader = TRAINERS['gym-granit']
    expect(leader.sprite).toBeDefined()
    const others = Object.values(TRAINERS).filter(t => t !== leader).map(t => spriteFor(t))
    expect(others).not.toContain(spriteFor(leader))
    expect(spriteFor(leader)).not.toBe(PLAYER_SPRITE)
  })
})
