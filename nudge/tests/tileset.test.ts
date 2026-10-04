import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAPS } from '../game/maps'
import { TILES } from '../game/tiles'
import { autotilePiece, BUILDINGS, buildingAt, describeTile, doorOf, SHEETS, type TileLayer } from '../game/tileset-manifest'

const PUBLIC = join(__dirname, '..', '..', 'public')

function pngSize(file: string): { w: number, h: number } {
  const buf = readFileSync(file)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

describe('autotiling', () => {
  it('picks the 3x3 block pieces for wide regions', () => {
    expect(autotilePiece(false, true, false, true)).toEqual({ col: 0, row: 0 }) // top-left corner
    expect(autotilePiece(false, true, true, true)).toEqual({ col: 1, row: 0 }) // top edge
    expect(autotilePiece(false, true, true, false)).toEqual({ col: 2, row: 0 })
    expect(autotilePiece(true, true, false, true)).toEqual({ col: 0, row: 1 }) // left edge
    expect(autotilePiece(true, true, true, true)).toEqual({ col: 1, row: 1 }) // centre
    expect(autotilePiece(true, true, true, false)).toEqual({ col: 2, row: 1 })
    expect(autotilePiece(true, false, false, true)).toEqual({ col: 0, row: 2 })
    expect(autotilePiece(true, false, true, true)).toEqual({ col: 1, row: 2 })
    expect(autotilePiece(true, false, true, false)).toEqual({ col: 2, row: 2 })
  })

  it('uses the strips for one-tile-wide paths and the island piece for a lone tile', () => {
    expect(autotilePiece(false, true, false, false)).toEqual({ col: 3, row: 0 }) // vertical strip, top end
    expect(autotilePiece(true, true, false, false)).toEqual({ col: 3, row: 1 })
    expect(autotilePiece(true, false, false, false)).toEqual({ col: 3, row: 2 })
    expect(autotilePiece(false, false, false, true)).toEqual({ col: 0, row: 3 }) // horizontal strip, left end
    expect(autotilePiece(false, false, true, true)).toEqual({ col: 1, row: 3 })
    expect(autotilePiece(false, false, true, false)).toEqual({ col: 2, row: 3 })
    expect(autotilePiece(false, false, false, false)).toEqual({ col: 3, row: 3 })
  })

  it('treats the map edge as more of the same, so paths run off the map without a rim', () => {
    const map = { tiles: ['=='] }
    const [layer] = describeTile(map, 0, 0) as Extract<TileLayer, { sheet: string }>[]
    // up/down/left edge count as path: centre of the 3x3 block would need all four, here right is path too
    expect(layer).toMatchObject({ sheet: 'floor', tx: 1, ty: 8 })
  })

  it('autotiles a small lake: corners, edges and an animated centre', () => {
    const map = { tiles: ['....', '.~~.', '.~~.', '....'] }
    const at = (x: number, y: number) => describeTile(map, x, y, { frame: 0 })
    expect(at(1, 1)[0]).toMatchObject({ sheet: 'water', tx: 0, ty: 6 }) // top-left corner
    expect(at(2, 1)[0]).toMatchObject({ sheet: 'water', tx: 2, ty: 6 })
    expect(at(1, 2)[0]).toMatchObject({ sheet: 'water', tx: 0, ty: 8 })
    expect(at(2, 2)[0]).toMatchObject({ sheet: 'water', tx: 2, ty: 8 })
    const big = { tiles: ['.....', '.~~~.', '.~~~.', '.~~~.', '.....'] }
    const centre = describeTile(big, 2, 2, { frame: 1 })
    expect(centre).toHaveLength(2)
    expect(centre[1]).toMatchObject({ sheet: 'ripples' })
  })
})

describe('tile sprites', () => {
  const allLayers: { map: string, layer: TileLayer }[] = []
  for (const map of Object.values(MAPS)) {
    for (let ty = 0; ty < map.tiles.length; ty++) {
      for (let tx = 0; tx < map.tiles[ty].length; tx++) {
        for (const frame of [0, 1, 2, 3]) for (const layer of describeTile(map, tx, ty, { frame })) allLayers.push({ map: map.id, layer })
      }
    }
  }

  it('every sprite lies inside its sheet', () => {
    expect(allLayers.length).toBeGreaterThan(1000)
    for (const { map, layer } of allLayers) {
      if ('badge' in layer) continue
      const sheet = SHEETS[layer.sheet]
      expect(layer.tx, `${map} ${JSON.stringify(layer)}`).toBeGreaterThanOrEqual(0)
      expect(layer.tx, `${map} ${JSON.stringify(layer)}`).toBeLessThan(sheet.cols)
      expect(layer.ty, `${map} ${JSON.stringify(layer)}`).toBeGreaterThanOrEqual(0)
      expect(layer.ty, `${map} ${JSON.stringify(layer)}`).toBeLessThan(sheet.rows)
    }
  })

  it('the declared sheet sizes match the PNG files', () => {
    for (const [id, sheet] of Object.entries(SHEETS)) {
      const file = join(PUBLIC, sheet.src)
      expect(existsSync(file), id).toBe(true)
      const { w, h } = pngSize(file)
      expect(w / 16, id).toBe(sheet.cols)
      expect(Math.floor(h / 16), id).toBe(sheet.rows)
    }
  })

  it('every outdoor tile character used on a map has sprites, indoor walls and mats use the fallback painters', () => {
    for (const map of Object.values(MAPS)) {
      for (let ty = 0; ty < map.tiles.length; ty++) {
        for (let tx = 0; tx < map.tiles[ty].length; tx++) {
          const char = map.tiles[ty][tx]
          expect(TILES[char], `${map.id} has unknown tile ${char}`).toBeDefined()
          const layers = describeTile(map, tx, ty)
          if (!map.indoor) expect(layers.length, `${map.id} ${char} at ${tx},${ty}`).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('buildings', () => {
  it('footprints are solid (except the door) and the door tile is a warp', () => {
    for (const map of Object.values(MAPS)) {
      for (const placement of map.buildings ?? []) {
        const sprite = BUILDINGS[placement.kind]
        const door = doorOf(placement)
        for (let dy = 0; dy < sprite.h; dy++) {
          for (let dx = 0; dx < sprite.w; dx++) {
            const x = placement.x + dx
            const y = placement.y + dy
            const char = map.tiles[y]?.[x]
            const label = `${map.id} ${placement.kind} at ${x},${y}`
            if (x === door.x && y === door.y) {
              expect(char, label).toBe('D')
              expect(map.warps.some(w => w.x === x && w.y === y), `${label} needs a warp`).toBe(true)
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

  it('Pokémon Center, Pokémart and the gym are recognisable by their badges', () => {
    expect(BUILDINGS.center.badge).toBe('cross')
    expect(BUILDINGS.mart.badge).toBe('bag')
    expect(BUILDINGS.gym.badge).toBe('dojo')
    const gruss = MAPS.gruss
    const badges = []
    for (let ty = 0; ty < gruss.tiles.length; ty++) {
      for (let tx = 0; tx < gruss.tiles[ty].length; tx++) {
        for (const layer of describeTile(gruss, tx, ty)) if ('badge' in layer) badges.push(layer.badge)
      }
    }
    expect(badges.sort()).toEqual(['bag', 'cross', 'dojo'])
  })
})
