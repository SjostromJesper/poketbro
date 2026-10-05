import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILDING_KINDS, buildingAt, doorOf, FOOTPRINT } from '../game/buildings'
import { MAPS } from '../game/maps'
import { LOOK_SPRITE, PLAYER_SPRITE, spriteFor } from '../game/sprites'
import { TILES } from '../game/tiles'
import { TRAINERS } from '../game/trainers'
import { frameFor } from '../game/themes/characters'
import { autotilePiece, describeTile, treeLayer } from '../game/themes/engine'
import { DEFAULT_THEME, THEME_IDS, THEMES } from '../game/themes'
import { SPRITE_KEYS, spriteSize, type Layer, type Ref, type ThemeManifest } from '../game/themes/types'

const PUBLIC = join(__dirname, '..', '..', 'public')
// Pipoya's files are not in the repository (they may not be redistributed): its file checks only run where they were copied.
const filesPresent = (id: string) => id !== 'pipoya' || existsSync(join(PUBLIC, 'assets', 'themes', 'pipoya', 'tiles'))

function pngSize(file: string): { w: number, h: number } {
  const buf = readFileSync(file)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const refsOf = (layers: Layer[]): Ref[] => layers.filter((l): l is Ref => 'sheet' in l)

describe('autotiling', () => {
  it('picks the 3x3 block pieces for wide regions', () => {
    expect(autotilePiece(false, true, false, true)).toEqual({ col: 0, row: 0 })
    expect(autotilePiece(false, true, true, true)).toEqual({ col: 1, row: 0 })
    expect(autotilePiece(true, true, true, true)).toEqual({ col: 1, row: 1 })
    expect(autotilePiece(true, false, true, false)).toEqual({ col: 2, row: 2 })
  })

  it('uses strips and the island piece only for sheets that have them', () => {
    expect(autotilePiece(false, true, false, false)).toEqual({ col: 3, row: 0 })
    expect(autotilePiece(false, false, true, true)).toEqual({ col: 1, row: 3 })
    expect(autotilePiece(false, false, false, false)).toEqual({ col: 3, row: 3 })
    // block-only sheets use the centre column/row for one-tile-wide runs
    expect(autotilePiece(false, true, false, false, false)).toEqual({ col: 1, row: 0 })
  })

  it('treats the map edge as more of the same and a path above a door as connected', () => {
    const [piece] = describeTile(THEMES.ninja, { tiles: ['=='] }, 0, 0) as Ref[]
    expect(piece).toMatchObject({ sheet: 'floor', tx: 1, ty: 8 })
  })

  it('fill themes get a rim only where the neighbour is another kind', () => {
    const map = { tiles: ['.~.', '.~.'] }
    const water = describeTile(THEMES.tuxemon, map, 1, 0)
    expect(water.some(l => 'edges' in l)).toBe(true)
    const inner = describeTile(THEMES.tuxemon, { tiles: ['~~~', '~~~', '~~~'] }, 1, 1)
    expect(inner.some(l => 'edges' in l)).toBe(false)
  })
})

describe('trees', () => {
  const def = THEMES.ninja.tiles.trees
  it('pairs 2x2 trees along a row and vertically from the bottom, with bushes for the odd one out', () => {
    const map = { tiles: ['###', '###'] }
    const tl = treeLayer(def, map, 0, 0)
    const tr = treeLayer(def, map, 1, 0)
    expect(tr.tx).toBe(tl.tx + 1)
    const bottom = treeLayer(def, map, 0, 1)
    expect(bottom.ty).toBe(tl.ty + 1)
    expect(def.bushes).toContainEqual(treeLayer(def, map, 2, 0))
  })
})

describe.each(THEME_IDS)('theme %s', (id) => {
  const theme: ThemeManifest = THEMES[id]

  it('its sheets exist and have the declared size', () => {
    if (!filesPresent(id)) return
    for (const [name, sheet] of Object.entries(theme.sheets)) {
      const file = join(PUBLIC, sheet.src)
      expect(existsSync(file), `${id}/${name}`).toBe(true)
      const { w, h } = pngSize(file)
      expect(Math.floor(w / sheet.tileSize), `${id}/${name} columns`).toBe(sheet.cols)
      expect(Math.floor(h / sheet.tileSize), `${id}/${name} rows`).toBe(sheet.rows)
    }
  })

  it('every piece drawn for every map tile lies inside its sheet, in every animation frame', () => {
    let count = 0
    for (const map of Object.values(MAPS)) {
      for (let ty = 0; ty < map.tiles.length; ty++) {
        for (let tx = 0; tx < map.tiles[ty].length; tx++) {
          for (const frame of [0, 1, 2, 3]) {
            for (const ref of refsOf(describeTile(theme, map, tx, ty, { frame }))) {
              const sheet = theme.sheets[ref.sheet]
              const label = `${id} ${map.id} ${JSON.stringify(ref)}`
              expect(sheet, label).toBeDefined()
              expect(ref.tx, label).toBeGreaterThanOrEqual(0)
              expect(ref.ty, label).toBeGreaterThanOrEqual(0)
              expect(ref.tx + (ref.w ?? 1), label).toBeLessThanOrEqual(sheet.cols)
              expect(ref.ty + (ref.h ?? 1), label).toBeLessThanOrEqual(sheet.rows)
              count++
            }
          }
        }
      }
    }
    expect(count).toBeGreaterThan(1000)
  })

  it('every outdoor tile of every map has something to draw', () => {
    for (const map of Object.values(MAPS)) {
      for (let ty = 0; ty < map.tiles.length; ty++) {
        for (let tx = 0; tx < map.tiles[ty].length; tx++) {
          const char = map.tiles[ty][tx]
          expect(TILES[char], `${map.id} has unknown tile ${char}`).toBeDefined()
          if (!map.indoor) expect(describeTile(theme, map, tx, ty).length, `${id} ${map.id} ${char} at ${tx},${ty}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('building sprites fit the logical footprint and the door lines up', () => {
    for (const kind of BUILDING_KINDS) {
      const sprite = theme.tiles.buildings[kind]
      expect(sprite, `${id} ${kind}`).toBeDefined()
      const { w, h } = spriteSize(sprite)
      expect(w).toBeLessThanOrEqual(FOOTPRINT.w)
      expect(h).toBeLessThanOrEqual(FOOTPRINT.h)
      const offset = FOOTPRINT.door - sprite.door
      expect(offset, `${id} ${kind} door column`).toBeGreaterThanOrEqual(0)
      expect(offset + w, `${id} ${kind} fits to the right`).toBeLessThanOrEqual(FOOTPRINT.w)
    }
  })

  it('has a character sheet for every look, with frames inside the sheet, and walking changes the frame', () => {
    if (!filesPresent(id)) return
    for (const key of SPRITE_KEYS) {
      const def = theme.characters[key]
      expect(def, `${id} ${key}`).toBeDefined()
      const file = join(PUBLIC, def.sheet)
      expect(existsSync(file), `${id} ${key} ${def.sheet}`).toBe(true)
      const { w, h } = pngSize(file)
      for (const facing of ['down', 'up', 'left', 'right'] as const) {
        for (const walk of [-1, 0, 0.3, 0.6, 0.99]) {
          const f = frameFor(def.layout, facing, walk)
          expect(f.sx + f.sw, `${id} ${key} ${facing} ${walk}`).toBeLessThanOrEqual(w)
          expect(f.sy + f.sh, `${id} ${key} ${facing} ${walk}`).toBeLessThanOrEqual(h)
        }
      }
      if (def.face) expect(existsSync(join(PUBLIC, def.face)), `${id} ${key} face`).toBe(true)
      const frames = new Set([0, 0.3, 0.6, 0.9].map(p => JSON.stringify(frameFor(def.layout, 'down', p))))
      if (!def.layout.bob) expect(frames.size, `${id} ${key} walk cycle`).toBeGreaterThan(1)
    }
  })

  it('lists its credits', () => {
    expect(theme.credits.length).toBeGreaterThan(0)
    for (const entry of theme.credits) expect(entry.url).toMatch(/^https:\/\//)
  })
})

describe('themes', () => {
  it('Tuxemon is the default and Ninja Adventure is still there', () => {
    expect(DEFAULT_THEME).toBe('tuxemon')
    expect(THEME_IDS).toContain('ninja')
  })

  it('each theme has a distinct look (different ground sheet or piece)', () => {
    const grounds = THEME_IDS.map(id => JSON.stringify(THEMES[id].tiles.ground[0]))
    expect(new Set(grounds).size).toBe(THEME_IDS.length)
  })
})

describe('buildings on the logical map', () => {
  it('footprints are solid (except the door) and the door tile is a warp', () => {
    for (const map of Object.values(MAPS)) {
      for (const placement of map.buildings ?? []) {
        const door = doorOf(placement)
        for (let dy = 0; dy < FOOTPRINT.h; dy++) {
          for (let dx = 0; dx < FOOTPRINT.w; dx++) {
            const x = placement.x + dx
            const y = placement.y + dy
            const char = map.tiles[y]?.[x]
            const label = `${map.id} ${placement.kind} at ${x},${y}`
            if (x === door.x && y === door.y && char === 'D') {
              expect(map.warps.some(w => w.x === x && w.y === y), `${label} needs a warp`).toBe(true)
            } else if (x === door.x && y === door.y) {
              // Scenery: a house you cannot enter has a solid wall where the door would be.
              expect('RW', label).toContain(char)
              expect(map.warps.some(w => w.x === x && w.y === y), `${label} is scenery and must not warp`).toBe(false)
            } else {
              expect('RW', label).toContain(char)
            }
          }
        }
      }
    }
  })

  it('every roof/wall/door tile on an outdoor map belongs to a building', () => {
    for (const map of Object.values(MAPS)) {
      if (map.indoor) continue
      for (let ty = 0; ty < map.tiles.length; ty++) {
        for (let tx = 0; tx < map.tiles[ty].length; tx++) {
          if ('RWD'.includes(map.tiles[ty][tx])) expect(buildingAt(map, tx, ty), `${map.id} ${tx},${ty}`).not.toBeNull()
        }
      }
    }
  })
})

describe('character looks', () => {
  it('every NPC look and every trainer resolves to a look (the PC is an object)', () => {
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs) {
        const sprite = spriteFor(npc)
        if (npc.look === 'pc') expect(sprite).toBeNull()
        else expect(SPRITE_KEYS, `${map.id} ${npc.id}`).toContain(sprite)
      }
    }
    for (const trainer of Object.values(TRAINERS)) expect(SPRITE_KEYS, trainer.id).toContain(spriteFor(trainer))
    for (const sprite of Object.values(LOOK_SPRITE)) expect(SPRITE_KEYS).toContain(sprite)
    expect(SPRITE_KEYS).toContain(PLAYER_SPRITE)
  })

  it('the gym leader looks different from everyone else', () => {
    const leader = TRAINERS['gym-granit']
    expect(leader.sprite).toBeDefined()
    const others = Object.values(TRAINERS).filter(t => t !== leader).map(t => spriteFor(t))
    expect(others).not.toContain(spriteFor(leader))
  })
})
