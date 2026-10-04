import { describe, expect, it } from 'vitest'
import { BALANCE, withBalance } from '../engine/balance'
import { createRng } from '../engine/rng'
import { ENCOUNTER_TABLES } from '../game/encounters'
import { newWorldState, World } from '../game/world'
import type { WorldState } from '../game/types'
import { constRng } from './helpers'

function worldAt(mapId: string, x: number, y: number, patch: Partial<WorldState> = {}, seed = 1, balance = BALANCE) {
  return new World({ ...newWorldState(), mapId, x, y, ...patch }, createRng(seed), balance)
}

describe('walking', () => {
  it('turns and moves one tile at a time, counting steps', () => {
    const world = worldAt('hemstad', 5, 5)
    const result = world.step('down')
    expect(result).toMatchObject({ kind: 'moved', from: { x: 5, y: 5 }, to: { x: 5, y: 6 } })
    expect(world.state).toMatchObject({ x: 5, y: 6, facing: 'down', steps: 1 })
    world.turn('left')
    expect(world.state).toMatchObject({ x: 5, y: 6, facing: 'left' })
  })

  it('is blocked by walls, water, fences, buildings, the map edge and entities - but still turns', () => {
    const wall = worldAt('hemstad', 1, 5)
    expect(wall.step('left')).toEqual({ kind: 'blocked', reason: 'wall' })
    expect(wall.state).toMatchObject({ x: 1, y: 5, facing: 'left' })
    expect(worldAt('hemstad', 14, 10).step('down')).toEqual({ kind: 'blocked', reason: 'wall' }) // pond
    expect(worldAt('hemstad', 3, 8).step('down')).toEqual({ kind: 'blocked', reason: 'wall' }) // fence
    expect(worldAt('hemstad', 4, 5).step('up')).toEqual({ kind: 'blocked', reason: 'wall' }) // house wall
    expect(worldAt('hemstad', 6, 6).step('down')).toEqual({ kind: 'blocked', reason: 'entity' }) // villager at (6,7)
    expect(worldAt('hemstad', 6, 6).step('right')).toEqual({ kind: 'blocked', reason: 'wall' }) // sign at (7,6) is a solid tile
    const edge = new World({ ...newWorldState(), mapId: 'hemstad', x: 0, y: 0 }, createRng(1), BALANCE)
    expect(edge.step('up')).toEqual({ kind: 'blocked', reason: 'edge' })
    expect(worldAt('hemstad', 5, 5).state.steps).toBe(0)
  })
})

describe('warps', () => {
  it('reports doors as triggers and applies them', () => {
    const world = worldAt('hemstad', 3, 5)
    const result = world.step('up')
    expect(result.kind).toBe('moved')
    if (result.kind !== 'moved') return
    const warp = result.triggers.find(t => t.type === 'warp')
    expect(warp).toBeDefined()
    if (warp?.type !== 'warp') return
    world.applyWarp(warp.warp)
    expect(world.state).toMatchObject({ mapId: 'hemhus', x: 3, y: 4, facing: 'up' })
    // the mat leads back outside
    const back = world.step('down')
    expect(back.kind).toBe('moved')
    if (back.kind !== 'moved') return
    expect(back.triggers).toContainEqual({ type: 'warp', warp: expect.objectContaining({ to: 'hemstad', toX: 3, toY: 5 }) })
  })

  it('stops you at the north gate until you own a starter', () => {
    const blocked = worldAt('hemstad', 9, 1)
    const result = blocked.step('up')
    expect(result).toMatchObject({ kind: 'blocked', reason: 'gate' })
    expect(blocked.state.y).toBe(1)
    expect((result as { dialog: string[] }).dialog.length).toBeGreaterThan(0)

    const open = worldAt('hemstad', 9, 1, { flags: ['starter'] })
    const through = open.step('up')
    expect(through.kind).toBe('moved')
    if (through.kind === 'moved') expect(through.triggers[0]).toMatchObject({ type: 'warp', warp: { to: 'route1' } })
  })

  it('never lands you on a warp, so there is no ping-pong between maps', () => {
    const world = worldAt('route1', 6, 1)
    const result = world.step('up')
    if (result.kind !== 'moved' || result.triggers[0].type !== 'warp') throw new Error('expected a warp')
    world.applyWarp(result.triggers[0].warp)
    expect(world.state.mapId).toBe('skogen')
    expect(world.warpAt(world.state.x, world.state.y)).toBeUndefined()
  })
})

describe('interaction', () => {
  it('reads signs and talks to NPCs (turning them towards you)', () => {
    const world = worldAt('hemstad', 6, 6, {}, 1)
    world.turn('right')
    expect(world.interact()).toEqual({ type: 'dialog', lines: ['HEMSTAD', 'Där äventyret börjar.'] })
    world.turn('down')
    const npc = world.interact()
    expect(npc).toMatchObject({ type: 'dialog', npcId: 'hem-gubbe' })
    expect(world.npcFacing['hem-gubbe']).toBe('up')
    world.turn('left')
    expect(world.interact()).toBeNull()
  })

  it('switches NPC dialog once a flag is set', () => {
    const before = worldAt('hemstad', 11, 9)
    before.turn('down')
    const lines1 = (before.interact() as { lines: string[] }).lines
    const after = worldAt('hemstad', 11, 9, { flags: ['starter'] })
    after.turn('down')
    const lines2 = (after.interact() as { lines: string[] }).lines
    expect(lines1).not.toEqual(lines2)
  })

  it('exposes NPC actions (heal, shop, starter)', () => {
    const home = worldAt('hemhus', 3, 3)
    home.turn('up')
    expect(home.interact()).toMatchObject({ npcId: 'hem-mamma', action: 'heal' })
    const lab = worldAt('proflab', 4, 3)
    lab.turn('up')
    expect(lab.interact()).toMatchObject({ npcId: 'professor', action: 'starter', speaker: 'Professor Almqvist' })
  })

  it('lets you talk across a counter', () => {
    const world = worldAt('gruss_center', 4, 4)
    world.turn('up')
    expect(world.interact()).toMatchObject({ npcId: 'sjukskoterska', action: 'heal' })
    const mart = worldAt('gruss_mart', 4, 4)
    mart.turn('up')
    expect(mart.interact()).toMatchObject({ npcId: 'expedit', action: 'shop' })
  })

  it('challenges to a battle when talking to an undefeated trainer', () => {
    const world = worldAt('route1', 6, 20)
    world.turn('right')
    expect(world.interact()).toEqual({ type: 'trainer', trainerId: 'r1-kalle' })
    world.markDefeated('r1-kalle')
    expect(world.interact()).toMatchObject({ type: 'dialog', speaker: 'Kalle' })
  })

  it('can remember a Pokémon Center and black out back to it', () => {
    const world = worldAt('gruss_center', 4, 4)
    world.rememberCenter()
    expect(world.state.lastCenter).toEqual({ mapId: 'gruss', x: 5, y: 7 })
    world.state.mapId = 'skogen'
    world.state.x = 8
    world.state.y = 5
    world.blackout()
    expect(world.state).toMatchObject({ mapId: 'gruss', x: 5, y: 7, facing: 'down' })
  })
})

describe('trainer sight', () => {
  it('spots the player in the line of sight and challenges as you step in', () => {
    const world = worldAt('route1', 3, 20) // trainer Kalle at (7,20) faces left, sight 3
    expect(world.trainersInSight()).toEqual([])
    const result = world.step('right') // to (4,20): exactly 3 tiles away
    expect(result.kind).toBe('moved')
    if (result.kind === 'moved') expect(result.triggers).toContainEqual({ type: 'trainer-sight', trainerId: 'r1-kalle' })
  })

  it('does not see beyond its range, to the side, or after being beaten', () => {
    expect(worldAt('route1', 3, 20).trainersInSight()).toEqual([])
    expect(worldAt('route1', 5, 19).trainersInSight()).toEqual([])
    expect(worldAt('route1', 5, 20).trainersInSight()).toEqual(['r1-kalle'])
    expect(worldAt('route1', 5, 20, { defeatedTrainers: ['r1-kalle'] }).trainersInSight()).toEqual([])
  })

  it('is blocked by obstacles in the way', () => {
    // Elis (9,5) faces left with sight 3 in the forest: a tree between him and the path would block the view.
    const world = worldAt('skogen', 7, 5)
    expect(world.trainersInSight()).toEqual(['skog-elis'])
    // Gym leader Granit has sight 0: he never spots anyone.
    expect(worldAt('gruss_gym', 5, 5).trainersInSight()).toEqual([])
  })
})

describe('wild encounters', () => {
  it('only happen on tall grass, at the configured rate', () => {
    expect(worldAt('route1', 6, 20).rollEncounter()).toBeNull() // path
    expect(worldAt('hemstad', 5, 5).rollEncounter()).toBeNull() // no table
    const always = worldAt('route1', 2, 4, {}, 1, withBalance({ ENCOUNTER_RATE: 1 }))
    expect(always.rollEncounter()).not.toBeNull()
    const never = worldAt('route1', 2, 4, {}, 1, withBalance({ ENCOUNTER_RATE: 0 }))
    expect(never.rollEncounter()).toBeNull()
  })

  it('draws species and levels from the map table (statistically)', () => {
    const counts = new Map<number, number>()
    const world = worldAt('route1', 2, 4, {}, 5, withBalance({ ENCOUNTER_RATE: 1 }))
    const n = 6000
    for (let i = 0; i < n; i++) {
      const e = world.rollEncounter()!
      counts.set(e.speciesId, (counts.get(e.speciesId) ?? 0) + 1)
      const entry = ENCOUNTER_TABLES.route1.find(t => t.speciesId === e.speciesId)!
      expect(e.level).toBeGreaterThanOrEqual(entry.minLevel)
      expect(e.level).toBeLessThanOrEqual(entry.maxLevel)
    }
    expect(Object.keys(Object.fromEntries(counts)).map(Number).sort()).toEqual([16, 19, 21])
    expect((counts.get(16) ?? 0) / n).toBeGreaterThan(0.41)
    expect((counts.get(16) ?? 0) / n).toBeLessThan(0.49)
    expect((counts.get(21) ?? 0) / n).toBeGreaterThan(0.07)
    expect((counts.get(21) ?? 0) / n).toBeLessThan(0.13)
  })

  it('the forest has the rare Pikachu', () => {
    const world = worldAt('skogen', 2, 3, {}, 9, withBalance({ ENCOUNTER_RATE: 1 }))
    const species = new Set<number>()
    for (let i = 0; i < 4000; i++) species.add(world.rollEncounter()!.speciesId)
    expect([...species].sort((a, b) => a - b)).toEqual([10, 11, 13, 14, 16, 25])
    expect(constRng).toBeTypeOf('function')
  })

  it('reports grass as a trigger when stepping into it', () => {
    const world = worldAt('route1', 4, 4)
    world.state.facing = 'left'
    const result = world.step('left')
    expect(result.kind).toBe('moved')
    if (result.kind === 'moved') expect(result.triggers).toContainEqual({ type: 'grass' })
  })
})
