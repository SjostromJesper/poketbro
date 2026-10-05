// Checks of the whole world (PLAN-3 4.6), pure so they can run as tests and as a report (`npm run check-world`):
// warps and return paths, reachability from the start with the badge gates in order, entities on walkable tiles, species and moves.
import type { GameData } from '../data/types'
import { createWildPokemon } from '../engine/ai'
import { BALANCE } from '../engine/balance'
import { ENCOUNTER_TABLES, FISHING_TABLES } from './encounters'
import { MAPS, START_MAP } from './maps'
import { obtainable } from './pokedex'
import { TILES } from './tiles'
import { TRAINERS } from './trainers'
import type { MapDef, TrainerDef } from './types'
import { createRng } from '../engine/rng'

/** Legendary Pokémon (and Mew/Mewtwo) are not part of the target of 100 catchable species. */
export const EXCLUDED_FROM_COVERAGE = new Set([144, 145, 146, 150, 151])

const tileOf = (map: MapDef, x: number, y: number) => {
  const c = map.tiles[y]?.[x]
  return c === undefined ? null : TILES[c] ?? null
}

export function allMaps(): MapDef[] {
  return Object.values(MAPS)
}

// ---------------------------------------------------------------------------
// Warps
// ---------------------------------------------------------------------------

export function warpProblems(): string[] {
  const problems: string[] = []
  for (const map of allMaps()) {
    for (const warp of map.warps) {
      const label = `${map.id} warp at ${warp.x},${warp.y} -> ${warp.to}`
      const here = tileOf(map, warp.x, warp.y)
      if (!here) problems.push(`${label}: the warp tile is outside the map`)
      else if (!here.walkable) problems.push(`${label}: the warp tile is not walkable (${map.tiles[warp.y][warp.x]})`)
      const target = MAPS[warp.to]
      if (!target) {
        problems.push(`${label}: no such map`)
        continue
      }
      const landing = tileOf(target, warp.toX, warp.toY)
      if (!landing?.walkable) problems.push(`${label}: lands on a blocked or missing tile (${warp.toX},${warp.toY})`)
      // A way back: the target has some warp to this map.
      if (!target.warps.some(w => w.to === map.id)) problems.push(`${label}: ${target.id} has no warp back to ${map.id}`)
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

export interface Reachability {
  /** Maps that can be reached, in the order they were found. */
  maps: string[]
  /** Maps that cannot be reached from the start at all. */
  unreachable: string[]
  /** Badge ids won, in order. */
  badges: string[]
  /** Reached tiles per map (for further checks). */
  tiles: Map<string, Set<string>>
}

/**
 * Walks the world like a player would: tiles you can step on, ledges downwards, warps (with their badge requirements), gate NPCs
 * that stand in the way until you have enough badges. Whenever a gym leader's map is reached the badge is "won" and the search is
 * repeated with one more badge, until nothing new is found. Trainers and pickups never block (they can be beaten / picked up);
 * other NPCs are walls.
 */
export function reachability(start = START_MAP): Reachability {
  const gymBadges = new Map<string, string>() // map id of the leader -> badge id
  for (const leader of Object.values(TRAINERS)) {
    const home = leader.gym ? allMaps().find(m => m.trainers.some(t => t.id === leader.id)) : undefined
    if (home && leader.gym) gymBadges.set(home.id, leader.gym.badge)
  }

  const walk = (badgeCount: number) => {
    const reached = new Map<string, Set<string>>()
    const order: string[] = []
    const queue: [string, number, number][] = [[start.mapId, start.x, start.y]]
    const blockedByNpc = (map: MapDef, x: number, y: number) => map.npcs.some(n => n.x === x && n.y === y && (!n.gate || badgeCount < n.gate.badges))
    while (queue.length) {
      const [mapId, x, y] = queue.pop()!
      const map = MAPS[mapId]
      if (!map) continue
      let seen = reached.get(mapId)
      if (!seen) {
        seen = new Set()
        reached.set(mapId, seen)
        order.push(mapId)
      }
      const key = `${x},${y}`
      if (seen.has(key)) continue
      seen.add(key)
      const warp = map.warps.find(w => w.x === x && w.y === y)
      if (warp && !(warp.requiresBadges && badgeCount < warp.requiresBadges)) queue.push([warp.to, warp.toX, warp.toY])
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        let ny = y + dy
        const tile = tileOf(map, nx, ny)
        if (!tile) continue
        if (tile.kind === 'ledge') {
          if (dy !== 1) continue
          ny++
          if (!tileOf(map, nx, ny)?.walkable) continue
        } else if (!tile.walkable) continue
        if (blockedByNpc(map, nx, ny)) continue
        const target = map.warps.find(w => w.x === nx && w.y === ny)
        if (target?.requiresBadges && badgeCount < target.requiresBadges) continue
        queue.push([mapId, nx, ny])
      }
    }
    return { reached, order }
  }

  let badgeCount = 0
  let result = walk(0)
  for (let round = 0; round < 20; round++) {
    const won = [...gymBadges].filter(([mapId]) => result.reached.has(mapId)).length
    if (won <= badgeCount) break
    badgeCount = won
    result = walk(badgeCount)
  }
  const badges = [...gymBadges].filter(([mapId]) => result.reached.has(mapId)).map(([, badge]) => badge)
  return { maps: result.order, unreachable: allMaps().map(m => m.id).filter(id => !result.reached.has(id)), badges, tiles: result.reached }
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export function entityProblems(): string[] {
  const problems: string[] = []
  for (const map of allMaps()) {
    const walkable = (x: number, y: number) => !!tileOf(map, x, y)?.walkable
    for (const n of map.npcs) if (!walkable(n.x, n.y)) problems.push(`${map.id}: NPC ${n.id} stands on a blocked tile (${n.x},${n.y})`)
    for (const t of map.trainers) {
      if (!walkable(t.x, t.y)) problems.push(`${map.id}: trainer ${t.id} stands on a blocked tile (${t.x},${t.y})`)
      if (!TRAINERS[t.id]) problems.push(`${map.id}: trainer ${t.id} has no definition`)
    }
    for (const p of map.pickups ?? []) if (!walkable(p.x, p.y)) problems.push(`${map.id}: pickup ${p.id} on a blocked tile`)
    const taken = new Set<string>()
    for (const e of [...map.npcs, ...map.trainers, ...(map.pickups ?? []).filter(p => !p.hidden)]) {
      const key = `${e.x},${e.y}`
      if (taken.has(key)) problems.push(`${map.id}: two things stand on ${key}`)
      taken.add(key)
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// Pokémon and moves
// ---------------------------------------------------------------------------

export function pokemonProblems(data: GameData): string[] {
  const problems: string[] = []
  const rng = createRng(7)
  const checkSpecies = (id: number, minLevel: number, maxLevel: number, label: string) => {
    if (!data.species[id]) return problems.push(`${label}: unknown species ${id}`)
    for (const level of new Set([minLevel, maxLevel])) {
      const mon = createWildPokemon({ data, balance: BALANCE, rng, speciesId: id, level })
      if (!mon.moves.length) problems.push(`${label}: ${data.species[id].name} has no moves at level ${level}`)
      for (const m of mon.moves) if (!data.moves[m.move]) problems.push(`${label}: ${data.species[id].name} has unknown move ${m.move}`)
    }
  }
  for (const [table, entries] of Object.entries(ENCOUNTER_TABLES)) for (const e of entries) checkSpecies(e.speciesId, e.minLevel, e.maxLevel, `encounters ${table}`)
  for (const [table, rods] of Object.entries(FISHING_TABLES)) {
    for (const [rod, entries] of Object.entries(rods)) for (const e of entries ?? []) checkSpecies(e.speciesId, e.minLevel, e.maxLevel, `fishing ${table}/${rod}`)
  }
  for (const trainer of Object.values(TRAINERS)) {
    if (trainer.team.length === 0 || trainer.team.length > 6) problems.push(`trainer ${trainer.id}: team size ${trainer.team.length}`)
    for (const m of trainer.team) {
      checkSpecies(m.speciesId, m.level, m.level, `trainer ${trainer.id}`)
      if (m.moves) {
        if (m.moves.length > BALANCE.MAX_MOVES) problems.push(`trainer ${trainer.id}: too many moves`)
        for (const move of m.moves) if (!data.moves[move]) problems.push(`trainer ${trainer.id}: unknown move ${move}`)
      }
    }
  }
  for (const map of allMaps()) {
    for (const npc of map.npcs) for (const p of npc.give?.pokemon ?? []) checkSpecies(p.speciesId, p.level, p.level, `gift ${npc.id}`)
    for (const item of (map.pickups ?? []).map(p => p.item)) if (!itemKnown(data, item)) problems.push(`${map.id}: unknown pickup item ${item}`)
    for (const npc of map.npcs) for (const g of npc.give?.items ?? []) if (!itemKnown(data, g.item)) problems.push(`${map.id}: ${npc.id} gives unknown item ${g.item}`)
  }
  return problems
}

function itemKnown(data: GameData, item: string): boolean {
  return item.startsWith('tm:') ? !!data.moves[item.slice(3)] : !!data.items[item]
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export interface Coverage {
  count: number
  obtainable: number[]
  missing: number[]
}

/** How many of the 151 species the player can get (wild, fishing, gifts, evolution), legendaries and Mew/Mewtwo not counted. */
export function coverage(data: GameData): Coverage {
  const got = obtainable(data)
  const all = Object.values(data.species).map(s => s.id).filter(id => !EXCLUDED_FROM_COVERAGE.has(id))
  const have = all.filter(id => got.has(id))
  return { count: have.length, obtainable: have, missing: all.filter(id => !got.has(id)) }
}
