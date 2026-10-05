import { describe, expect, it } from 'vitest'
import { BALANCE } from '../engine/balance'
import { mapBuilder, room } from '../game/mapBuilder'
import { MAPS } from '../game/maps'
import { coverage, entityProblems, pokemonProblems, reachability, warpProblems } from '../game/worldCheck'
import { TILES } from '../game/tiles'
import type { PickupDef } from '../game/types'
import { World, newWorldState } from '../game/world'
import { createRng } from '../engine/rng'
import { data } from './helpers'

/**
 * How many of the 151 species must be obtainable at the end of each milestone: 8 after P3-M5's first part is not meaningful yet,
 * the final target (P3-M6) is 100.
 */
const REQUIRED_COVERAGE = 12

describe('the world is consistent', () => {
  it('every warp points to an existing walkable tile and has a way back', () => {
    expect(warpProblems()).toEqual([])
  })

  it('every map can be reached from Hemstad (badge gates in order)', () => {
    const r = reachability()
    expect(r.unreachable).toEqual([])
    expect(r.maps[0]).toBe('hemstad')
  })

  it('nobody stands on a blocked tile or on top of someone else', () => {
    expect(entityProblems()).toEqual([])
  })

  it('every Pokémon in the encounter tables, teams and gifts exists and has valid moves for its level', () => {
    expect(pokemonProblems(data)).toEqual([])
  })

  it(`at least ${REQUIRED_COVERAGE} species can be obtained (the final goal is 100)`, () => {
    const c = coverage(data)
    console.log(`coverage: ${c.count} of ${c.count + c.missing.length} species obtainable`)
    expect(c.count).toBeGreaterThanOrEqual(REQUIRED_COVERAGE)
  })
})

describe('the reachability check', () => {
  it('knows that a badge gate blocks until the gym leader is beaten', () => {
    // Uses the real maps: the gate logic is exercised once world maps with gates exist; here we check the machinery on a tiny made-up world.
    const m = mapBuilder('t-gate', 7, 3, { name: 'Test' })
    m.fill(0, 0, 7, 3, 'ground')
    m.npc({ id: 'guard', x: 3, y: 1, facing: 'left', look: 'boy', dialog: ['Stopp!'], gate: { badges: 1 } })
    const map = m.build()
    const world = new World({ ...newWorldState(), mapId: 'hemstad' }, createRng(1), BALANCE)
    world.badgeCount = 0
    expect(world.npcActive(map.npcs[0])).toBe(true)
    world.badgeCount = 1
    expect(world.npcActive(map.npcs[0])).toBe(false)
  })
})

describe('the map builder', () => {
  it('compiles to the usual map format with buildings, warps and entities', () => {
    const m = mapBuilder('t-town', 20, 14, { name: 'Teststad', encounterTable: 'route1' })
    m.border('tree')
    m.path([[9, 13], [9, 6], [3, 6]], { width: 2 })
    m.blob(14, 9, 3, 2, 'water')
    m.scatter(2, 8, 6, 4, 'flowers', 4)
    m.building('houseA', 2, 1, { to: 't-house', toX: 3, toY: 4 })
    m.sign(8, 8, ['Hej'])
    m.npc({ id: 'n1', x: 6, y: 7, facing: 'down', look: 'girl', dialog: ['Hej'] })
    const map = m.build()
    expect(map.tiles).toHaveLength(14)
    expect(map.tiles.every(r => r.length === 20)).toBe(true)
    expect(map.tiles[0]).toBe('#'.repeat(20))
    expect(map.tiles[1][4]).toBe('R')
    expect(map.tiles[2][4]).toBe('W')
    expect(map.tiles[4][4]).toBe('D') // door in the middle of the bottom row of the footprint
    expect(map.warps).toEqual([{ x: 4, y: 4, to: 't-house', toX: 3, toY: 4 }])
    expect(map.buildings).toEqual([{ kind: 'houseA', x: 2, y: 1 }])
    expect(map.signs).toHaveLength(1)
    expect(map.tiles.join('')).toContain('~')
    for (const row of map.tiles) for (const c of row) expect(TILES[c], c).toBeDefined()
  })

  it('is deterministic', () => {
    const make = () => mapBuilder('same', 30, 30, { name: 'x' }).blob(15, 15, 8, 6, 'water', { roughness: 0.4 }).scatter(0, 0, 30, 30, 'tree', 20).path([[2, 2], [27, 27]], { wobble: 0.5 }).build().tiles
    expect(make()).toEqual(make())
  })

  it('refuses to place someone on a blocked tile', () => {
    const m = mapBuilder('t-bad', 5, 5, { name: 'x' }).fill(0, 0, 5, 5, 'tree')
    m.npc({ id: 'n', x: 2, y: 2, facing: 'down', look: 'boy', dialog: ['x'] })
    expect(() => m.build()).toThrow(/blocked tile/)
  })

  it('rooms have walls, a floor and a mat that leads outside', () => {
    const r = room('t-room', 8, 6, { name: 'Rum', exit: { to: 'hemstad', toX: 3, toY: 5 } }).build()
    expect(r.indoor).toBe(true)
    expect(r.tiles[0]).toBe('#'.repeat(8))
    expect(r.tiles[5][3]).toBe('M')
    expect(r.warps[0]).toMatchObject({ x: 3, y: 5, to: 'hemstad' })
  })
})

describe('ledges, pickups and fishing in the world logic', () => {
  function worldWith(rows: string[], extra: Record<string, unknown> = {}) {
    const m = mapBuilder('t-logic', rows[0].length, rows.length, { name: 'x' })
    rows.forEach((row, y) => [...row].forEach((c, x) => m.fill(x, y, 1, 1, c)))
    const map = { ...m.build(), ...extra }
    MAPS['t-logic'] = map
    const world = new World({ ...newWorldState(), mapId: 't-logic', x: 1, y: 0 }, createRng(5), BALANCE)
    return { world, cleanup: () => { delete MAPS['t-logic'] } }
  }

  it('a ledge is jumped over downwards only', () => {
    const { world, cleanup } = worldWith(['...', '.L.', '...', '...'])
    const down = world.step('down')
    expect(down).toMatchObject({ kind: 'moved', to: { x: 1, y: 2 } }) // lands behind the ledge
    // back up is blocked, and so is sideways onto it
    expect(world.step('up')).toMatchObject({ kind: 'blocked', reason: 'wall' })
    world.state.x = 0
    world.state.y = 1
    expect(world.step('right')).toMatchObject({ kind: 'blocked' })
    cleanup()
  })

  it('a gate NPC blocks until enough badges, hidden pickups are found by interacting, visible ones block', () => {
    const rows = ['...', '...', '...']
    const m = mapBuilder('t-logic', 3, 3, { name: 'x' })
    rows.forEach((row, y) => [...row].forEach((c, x) => m.fill(x, y, 1, 1, c)))
    m.npc({ id: 'guard', x: 1, y: 1, facing: 'up', look: 'old', dialog: ['Stopp'], gate: { badges: 2 } })
    m.pickup({ id: 'p-hidden', x: 2, y: 0, item: 'potion', hidden: true })
    m.pickup({ id: 'p-visible', x: 0, y: 2, item: 'poke-ball' })
    MAPS['t-logic'] = m.build()
    const world = new World({ ...newWorldState(), mapId: 't-logic', x: 1, y: 0 }, createRng(5), BALANCE)
    expect(world.step('down')).toMatchObject({ kind: 'blocked', reason: 'entity' })
    world.badgeCount = 2
    expect(world.step('down')).toMatchObject({ kind: 'moved' })
    // the visible ball blocks until collected
    world.state.x = 0
    world.state.y = 1
    expect(world.step('down')).toMatchObject({ kind: 'blocked', reason: 'entity' })
    world.state.facing = 'down'
    const found = world.interact()
    expect(found).toMatchObject({ type: 'pickup', pickup: { id: 'p-visible' } })
    world.collect((found as unknown as { pickup: PickupDef }).pickup)
    expect(world.step('down')).toMatchObject({ kind: 'moved' })
    // the hidden one: face its tile and interact
    world.state.x = 1
    world.state.y = 0
    world.state.facing = 'right'
    expect(world.interact()).toMatchObject({ type: 'pickup', pickup: { id: 'p-hidden' } })
    world.collect(m.build().pickups![0])
    expect(world.interact()).toBeNull()
    delete MAPS['t-logic']
  })

  it('facing water gives a fishing interaction', () => {
    const { world, cleanup } = worldWith(['.~.', '...'])
    world.state.facing = 'right'
    world.state.x = 0
    world.state.y = 0
    expect(world.interact()).toEqual({ type: 'water' })
    cleanup()
  })
})
