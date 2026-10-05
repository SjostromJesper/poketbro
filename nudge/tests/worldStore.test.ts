import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorldStore } from '../../app/stores/nudge/world'
import { newWorldState } from '../game/world'
import { MAPS } from '../game/maps'
import { BALANCE } from '../engine/balance'
import { DIRECTIONS, type Direction } from '../game/types'

/** Runs the store for `ms` of game time in 16 ms frames. */
function run(store: ReturnType<typeof useWorldStore>, ms: number) {
  for (let t = 0; t < ms; t += 16) store.update(16)
}

function startAt(mapId: string, x: number, y: number, flags: string[] = []) {
  const store = useWorldStore()
  store.start({ ...newWorldState(), mapId, x, y, flags }, 7)
  return store
}

beforeEach(() => setActivePinia(createPinia()))

describe('overworld controller', () => {
  it('walks one tile per step with smooth interpolation (~150 ms)', () => {
    const store = startAt('hemstad', 14, 12)
    store.keyDown('ArrowDown')
    run(store, 16) // the player already faces down, so the step starts at once
    expect(store.world!.state.y).toBe(13) // logical position updates immediately
    run(store, 32) // ...while the picture catches up smoothly
    expect(store.visual.y).toBeGreaterThan(12)
    expect(store.visual.y).toBeLessThan(13)
    // While the key stays down the picture moves smoothly and monotonically, never jumping more than a frame's worth.
    let previous = store.visual.y
    for (let t = 0; t < 600; t += 16) {
      store.update(16)
      expect(store.visual.y).toBeGreaterThanOrEqual(previous)
      expect(store.visual.y - previous).toBeLessThanOrEqual(16 / BALANCE.WALK_STEP_MS + 1e-6)
      previous = store.visual.y
    }
    expect(previous).toBeGreaterThanOrEqual(13) // keeps walking south through the village
    store.keyUp('ArrowDown')
    run(store, 400)
    expect(Number.isInteger(store.visual.y)).toBe(true)
    expect(store.visual.y).toBe(store.world!.state.y)
  })

  it('takes about 150 ms per tile when walking and 90 ms when running', () => {
    const walk = startAt('route1', 6, 20)
    walk.keyDown('ArrowDown')
    run(walk, 1000)
    walk.keyUp('ArrowDown')
    const walked = walk.world!.state.y - 20
    const sprint = startAt('route1', 6, 20)
    sprint.keyDown('Shift')
    sprint.keyDown('ArrowDown')
    run(sprint, 1000)
    sprint.keyUp('ArrowDown')
    const ran = sprint.world!.state.y - 20
    expect(walked).toBeGreaterThanOrEqual(Math.floor(1000 / BALANCE.WALK_STEP_MS) - 1)
    expect(walked).toBeLessThanOrEqual(Math.ceil(1000 / BALANCE.WALK_STEP_MS) + 1)
    expect(ran).toBeGreaterThan(walked * 1.4)
  })

  it('first turns on the spot when a new direction is tapped, and only walks if the key stays down', () => {
    const store = startAt('hemstad', 14, 12)
    store.keyDown('ArrowRight')
    run(store, 16)
    expect(store.world!.state).toMatchObject({ x: 14, y: 12, facing: 'right' })
    store.keyUp('ArrowRight') // a quick tap only turns
    run(store, 300)
    expect(store.world!.state).toMatchObject({ x: 14, y: 12, facing: 'right' })
    store.keyDown('ArrowLeft')
    run(store, 400) // held long enough: turn, then walk
    store.keyUp('ArrowLeft')
    expect(store.world!.state.x).toBeLessThan(14)
  })

  it('does not move through walls, water or people', () => {
    const store = startAt('hemstad', 5, 9)
    store.keyDown('ArrowUp')
    run(store, 600)
    store.keyUp('ArrowUp')
    expect(store.world!.state.y).toBe(9) // the house wall is directly above
    const village = startAt('hemstad', 9, 12)
    village.keyDown('ArrowDown')
    run(village, 600)
    village.keyUp('ArrowDown')
    expect(village.world!.state.y).toBe(12) // villager at (9,13)
  })

  it('supports WASD and ignores input while a dialog is open', () => {
    const store = startAt('hemstad', 14, 12)
    store.keyDown('d')
    run(store, 300)
    store.keyUp('d')
    expect(store.world!.state.x).toBeGreaterThan(5)
    const x = store.world!.state.x
    store.openDialog(['Hej!'])
    store.keyDown('a')
    run(store, 500)
    store.keyUp('a')
    expect(store.world!.state.x).toBe(x)
    expect(store.mode).toBe('dialog')
  })

  it('opens a dialog when talking to a sign or NPC, with a typewriter that can be skipped', () => {
    const store = startAt('hemstad', 11, 12)
    store.world!.turn('right')
    store.keyDown(' ')
    expect(store.mode).toBe('dialog')
    expect(store.dialog!.lines).toEqual(['HEMSTAD', 'Där äventyret börjar.'])
    run(store, 80)
    const partial = Math.floor(store.dialog!.revealed)
    expect(partial).toBeGreaterThan(0)
    expect(partial).toBeLessThan('HEMSTAD'.length + 1)
    store.keyDown('z') // skip to the end of the line
    expect(store.dialog!.revealed).toBe('HEMSTAD'.length)
    store.keyDown('Enter') // next line
    expect(store.dialog!.index).toBe(1)
    store.keyDown(' ')
    store.keyDown(' ')
    expect(store.mode).toBe('walk')
    expect(store.dialog).toBeNull()
  })

  it('calls the action hook after an NPC dialog finishes', () => {
    const store = startAt('hemhus', 3, 4)
    const calls: string[] = []
    store.setHooks({ onAction: (action, id) => calls.push(`${action}:${id}`) })
    store.world!.turn('up')
    store.keyDown(' ')
    expect(calls).toEqual([])
    for (let i = 0; i < 10 && store.mode === 'dialog'; i++) {
      run(store, 2000)
      store.keyDown(' ')
    }
    expect(calls).toEqual(['heal:hem-mamma'])
  })

  it('stops at the gate without a starter and explains why', () => {
    const store = startAt('hemstad', 14, 1)
    store.keyDown('ArrowUp')
    run(store, 200)
    expect(store.mode).toBe('dialog')
    expect(store.dialog!.lines[0]).toContain('Vänta')
    expect(store.world!.state.mapId).toBe('hemstad')
  })

  it('fades through a door, warps and shows the new map name', () => {
    const store = startAt('hemstad', 6, 9)
    const modes = new Set<string>()
    store.keyDown('ArrowUp')
    for (let t = 0; t < 1200; t += 16) {
      store.update(16)
      modes.add(store.mode)
      if (t === 300) store.keyUp('ArrowUp')
    }
    expect(modes.has('fade')).toBe(true)
    expect(store.mode).toBe('walk')
    expect(store.world!.state).toMatchObject({ mapId: 'hemhus', x: 3, y: 5, facing: 'up' })
    expect(store.visual).toMatchObject({ x: 3, y: 5, fade: 0 })
    expect(store.banner?.text).toBe('Ditt hem')
  })

  it('opens and closes the menu with Escape, which also blocks walking', () => {
    const store = startAt('hemstad', 14, 12)
    store.keyDown('Escape')
    expect(store.mode).toBe('menu')
    store.keyDown('ArrowDown')
    run(store, 400)
    store.keyUp('ArrowDown')
    expect(store.world!.state.y).toBe(12)
    store.keyDown('x')
    expect(store.mode).toBe('walk')
  })

  it('walks the whole way from Hemstad to Grusstad with the real controller (collisions, fades, warps, banners)', () => {
    const store = useWorldStore()
    // Every trainer is "beaten" so their sight lines do not interrupt the walk (that is covered elsewhere).
    const defeated = Object.values(MAPS).flatMap(m => m.trainers.map(t => t.id))
    store.start({ ...newWorldState(), flags: ['starter'], defeatedTrainers: defeated }, 11)
    const world = store.world!

    // Breadth-first search over (map, x, y) using the real map data; warp tiles lead to their destination.
    type Node = { mapId: string, x: number, y: number }
    const key = (n: Node) => `${n.mapId}:${n.x},${n.y}`
    const goal: Node = { mapId: 'gruss', x: 17, y: 12 }
    const start: Node = { ...world.state }
    const previous = new Map<string, { from: Node, dir: Direction }>()
    const seen = new Set([key(start)])
    const queue: Node[] = [start]
    while (queue.length && !seen.has('goal-found')) {
      const node = queue.shift()!
      if (key(node) === key(goal)) break
      const map = MAPS[node.mapId]
      for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
        const { dx, dy } = DIRECTIONS[dir]
        const x = node.x + dx
        const y = node.y + dy
        if (!world.isWalkable(x, y, map)) continue
        const warp = world.warpAt(x, y, map)
        const next: Node = warp ? { mapId: warp.to, x: warp.toX, y: warp.toY } : { mapId: node.mapId, x, y }
        if (seen.has(key(next))) continue
        seen.add(key(next))
        previous.set(key(next), { from: node, dir })
        queue.push(next)
      }
    }
    expect(previous.has(key(goal)), 'a route to Grusstad exists').toBe(true)
    const path: Direction[] = []
    for (let n = goal; key(n) !== key(start);) {
      const step = previous.get(key(n))!
      path.unshift(step.dir)
      n = step.from
    }
    expect(path.length).toBeGreaterThan(80)

    const mapsVisited: string[] = [store.world!.state.mapId]
    for (const dir of path) {
      store.holdDirection(dir)
      let waited = 0
      const before = `${world.state.mapId}:${world.state.x},${world.state.y}`
      // Wait for the logical position to change, then let the animation / fade finish.
      while (`${world.state.mapId}:${world.state.x},${world.state.y}` === before && waited < 2000) { store.update(16); waited += 16 }
      store.holdDirection(null)
      for (let t = 0; t < 1000 && (store.mode !== 'walk' || store.visual.walk >= 0 || store.visual.x !== world.state.x || store.visual.y !== world.state.y); t += 16) store.update(16)
      expect(store.mode, `after moving ${dir} at ${JSON.stringify(world.state)}`).toBe('walk')
      if (world.state.mapId !== mapsVisited.at(-1)) mapsVisited.push(world.state.mapId)
    }
    expect(mapsVisited).toEqual(['hemstad', 'route1', 'skogen', 'gruss'])
    expect(world.state).toMatchObject({ mapId: 'gruss', x: 17, y: 12 })
    expect(world.state.steps).toBeGreaterThan(80)
  })
})
