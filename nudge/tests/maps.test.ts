import { describe, expect, it } from 'vitest'
import { gameData } from '../data'
import { ENCOUNTER_TABLES } from '../game/encounters'
import { MAPS } from '../game/maps'
import { tileInfo, TILES } from '../game/tiles'
import { TRAINERS } from '../game/trainers'
import { DIRECTIONS, type MapDef } from '../game/types'
import { newWorldState, World } from '../game/world'
import { BALANCE } from '../engine/balance'
import { createRng } from '../engine/rng'

const maps = Object.values(MAPS)

function reachable(map: MapDef, start: { x: number, y: number }): Set<string> {
  const world = new World({ ...newWorldState(), mapId: map.id }, createRng(1), BALANCE)
  const seen = new Set<string>([`${start.x},${start.y}`])
  const queue = [start]
  while (queue.length) {
    const { x, y } = queue.shift()!
    for (const { dx, dy } of Object.values(DIRECTIONS)) {
      const nx = x + dx
      const ny = y + dy
      const key = `${nx},${ny}`
      if (seen.has(key)) continue
      const tile = world.tileAt(nx, ny, map)
      if (!tile?.walkable) continue
      if (world.entityAt(nx, ny, map)) continue
      seen.add(key)
      // Do not walk *through* a warp tile (it moves you to another map).
      if (!world.warpAt(nx, ny, map)) queue.push({ x: nx, y: ny })
    }
  }
  return seen
}

describe('map data', () => {
  it('has rectangular maps that only use known tile characters', () => {
    for (const map of maps) {
      const width = map.tiles[0].length
      for (const [y, row] of map.tiles.entries()) {
        expect(row.length, `${map.id} row ${y}`).toBe(width)
        for (const char of row) expect(TILES[char], `${map.id} row ${y}: "${char}"`).toBeDefined()
      }
    }
  })

  it('keeps every entity on a walkable tile, without overlaps', () => {
    for (const map of maps) {
      const world = new World({ ...newWorldState(), mapId: map.id }, createRng(1), BALANCE)
      const seen = new Set<string>()
      const positions = [...map.npcs, ...map.trainers].map(e => ({ id: e.id, x: e.x, y: e.y }))
      for (const p of positions) {
        expect(world.tileAt(p.x, p.y, map)?.walkable, `${map.id}/${p.id} stands on a blocked tile`).toBe(true)
        expect(world.warpAt(p.x, p.y, map), `${map.id}/${p.id} stands on a warp`).toBeUndefined()
        const key = `${p.x},${p.y}`
        expect(seen.has(key), `${map.id}: two entities at ${key}`).toBe(false)
        seen.add(key)
      }
      for (const sign of map.signs) expect(map.tiles[sign.y][sign.x], `${map.id} sign at ${sign.x},${sign.y}`).toBe('S')
      map.tiles.forEach((row, y) => [...row].forEach((char, x) => {
        if (char === 'S') expect(map.signs.some(s => s.x === x && s.y === y), `${map.id}: sign tile ${x},${y} has no sign`).toBe(true)
      }))
    }
  })

  it('has valid warps in both directions', () => {
    for (const map of maps) {
      const world = new World({ ...newWorldState(), mapId: map.id }, createRng(1), BALANCE)
      for (const warp of map.warps) {
        const source = tileInfo(map.tiles[warp.y]?.[warp.x] ?? '#')
        expect(source.walkable, `${map.id} warp at ${warp.x},${warp.y}`).toBe(true)
        const target = MAPS[warp.to]
        expect(target, `${map.id} warps to unknown map ${warp.to}`).toBeDefined()
        expect(world.isWalkable(warp.toX, warp.toY, target), `${map.id} -> ${warp.to} lands on a blocked tile (${warp.toX},${warp.toY})`).toBe(true)
        expect(world.warpAt(warp.toX, warp.toY, target), `${map.id} -> ${warp.to} lands on a warp tile`).toBeUndefined()
      }
      map.tiles.forEach((row, y) => [...row].forEach((char, x) => {
        if (char === 'D' || char === 'M') expect(world.warpAt(x, y, map), `${map.id}: door/mat ${x},${y} has no warp`).toBeDefined()
      }))
    }
  })

  it('defines every referenced trainer and encounter table', () => {
    for (const map of maps) {
      for (const spot of map.trainers) {
        const def = TRAINERS[spot.id]
        expect(def, `${map.id}: trainer ${spot.id}`).toBeDefined()
        expect(def.team.length).toBeGreaterThan(0)
        for (const mon of def.team) {
          expect(gameData.species[mon.speciesId]).toBeDefined()
          for (const move of mon.moves ?? []) expect(gameData.moves[move]).toBeDefined()
        }
        if (def.gym) expect(gameData.moves[def.gym.tm]).toBeDefined()
      }
      if (map.encounterTable) expect(ENCOUNTER_TABLES[map.encounterTable]).toBeDefined()
    }
    for (const table of Object.values(ENCOUNTER_TABLES)) {
      for (const e of table) {
        expect(gameData.species[e.speciesId]).toBeDefined()
        expect(e.minLevel).toBeLessThanOrEqual(e.maxLevel)
      }
    }
  })

  it('lets you walk from Hemstad through Route 1 and the forest to Grusstad, reaching every NPC, sign and door on the way', () => {
    // Flood fill over maps: from each map's reachable area, follow every warp to the destination map's arrival tile.
    const start = { mapId: 'hemstad', x: 3, y: 5 }
    const visited = new Map<string, Set<string>>()
    const queue = [start]
    while (queue.length) {
      const { mapId, x, y } = queue.shift()!
      const map = MAPS[mapId]
      const area = reachable(map, { x, y })
      const previous = visited.get(mapId)
      if (previous && [...area].every(k => previous.has(k))) continue
      visited.set(mapId, new Set([...(previous ?? []), ...area]))
      const world = new World({ ...newWorldState(), mapId }, createRng(1), BALANCE)
      for (const warp of map.warps) {
        // The warp tile itself must be enterable from the reachable area (stand next to it).
        const adjacent = Object.values(DIRECTIONS).some(({ dx, dy }) => area.has(`${warp.x + dx},${warp.y + dy}`))
        if (adjacent && world.tileAt(warp.x, warp.y, map)?.walkable) queue.push({ mapId: warp.to, x: warp.toX, y: warp.toY })
      }
    }
    expect([...visited.keys()].sort()).toEqual(Object.keys(MAPS).sort())
    // Every NPC/trainer/sign must be reachable by standing next to it.
    for (const map of maps) {
      const area = visited.get(map.id)!
      for (const e of [...map.npcs, ...map.trainers, ...map.signs]) {
        const near = Object.values(DIRECTIONS).some(({ dx, dy }) => area.has(`${e.x + dx},${e.y + dy}`))
        expect(near, `${map.id}: ${'id' in e ? e.id : `sign ${e.x},${e.y}`} cannot be reached`).toBe(true)
      }
    }
    // Grusstad (and its gym) are reachable.
    expect(visited.get('gruss')!.size).toBeGreaterThan(100)
    expect(visited.has('gruss_gym')).toBe(true)
  })
})
