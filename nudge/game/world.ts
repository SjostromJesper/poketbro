// Overworld logic: walking on the tile grid, collisions, warps, interaction, trainer sight and wild encounters.
// Pure TypeScript with discrete positions; the UI animates between tiles.
import type { Balance } from '../engine/balance'
import { pickWeightedIndex, randInt, type Rng } from '../engine/rng'
import { ENCOUNTER_TABLES } from './encounters'
import { getMap, START_MAP } from './maps'
import { tileInfo, type TileInfo } from './tiles'
import { TRAINERS } from './trainers'
import {
  DIRECTIONS, OPPOSITE, type Direction, type MapDef, type NpcAction, type NpcDef, type SignDef, type TrainerDef, type TrainerSpot,
  type WarpDef, type WorldState,
} from './types'

export function newWorldState(): WorldState {
  return {
    mapId: START_MAP.mapId,
    x: START_MAP.x,
    y: START_MAP.y,
    facing: 'down',
    defeatedTrainers: [],
    flags: [],
    lastCenter: { mapId: START_MAP.mapId, x: START_MAP.x, y: START_MAP.y },
    steps: 0,
  }
}

export type Entity =
  | { kind: 'npc', npc: NpcDef }
  | { kind: 'trainer', spot: TrainerSpot, def: TrainerDef }
  | { kind: 'sign', sign: SignDef }

export type Trigger =
  | { type: 'warp', warp: WarpDef }
  | { type: 'grass' }
  | { type: 'trainer-sight', trainerId: string }

export type StepResult =
  | { kind: 'blocked', reason: 'wall' | 'entity' | 'edge' | 'gate', dialog?: string[] }
  | { kind: 'moved', from: { x: number, y: number }, to: { x: number, y: number }, triggers: Trigger[] }

export type InteractResult =
  | { type: 'dialog', lines: string[], speaker?: string, npcId?: string, action?: NpcAction }
  | { type: 'trainer', trainerId: string }
  | null

export interface WildEncounter {
  speciesId: number
  level: number
}

export class World {
  /** Visual-only: where NPCs and trainers currently face (they turn towards the player when spoken to). */
  readonly npcFacing: Record<string, Direction> = {}

  constructor(public state: WorldState, private readonly rng: Rng, private readonly balance: Balance) {}

  get map(): MapDef {
    return getMap(this.state.mapId)
  }

  hasFlag(flag: string): boolean {
    return this.state.flags.includes(flag)
  }

  setFlag(flag: string): void {
    if (!this.hasFlag(flag)) this.state.flags.push(flag)
  }

  isDefeated(trainerId: string): boolean {
    return this.state.defeatedTrainers.includes(trainerId)
  }

  markDefeated(trainerId: string): void {
    if (!this.isDefeated(trainerId)) this.state.defeatedTrainers.push(trainerId)
  }

  // ---------------------------------------------------------------------------
  // Tiles and entities
  // ---------------------------------------------------------------------------

  tileChar(x: number, y: number, map: MapDef = this.map): string | null {
    const row = map.tiles[y]
    if (!row || x < 0 || x >= row.length) return null
    return row[x]
  }

  tileAt(x: number, y: number, map: MapDef = this.map): TileInfo | null {
    const char = this.tileChar(x, y, map)
    return char === null ? null : tileInfo(char)
  }

  entityAt(x: number, y: number, map: MapDef = this.map): Entity | null {
    const npc = map.npcs.find(n => n.x === x && n.y === y)
    if (npc) return { kind: 'npc', npc }
    const spot = map.trainers.find(t => t.x === x && t.y === y)
    if (spot) return { kind: 'trainer', spot, def: TRAINERS[spot.id] }
    const sign = map.signs.find(s => s.x === x && s.y === y)
    if (sign) return { kind: 'sign', sign }
    return null
  }

  warpAt(x: number, y: number, map: MapDef = this.map): WarpDef | undefined {
    return map.warps.find(w => w.x === x && w.y === y)
  }

  isWalkable(x: number, y: number, map: MapDef = this.map): boolean {
    const tile = this.tileAt(x, y, map)
    if (!tile || !tile.walkable) return false
    return this.entityAt(x, y, map) === null
  }

  facingOf(id: string, fallback: Direction): Direction {
    return this.npcFacing[id] ?? fallback
  }

  // ---------------------------------------------------------------------------
  // Walking
  // ---------------------------------------------------------------------------

  turn(dir: Direction): void {
    this.state.facing = dir
  }

  /** Tries to walk one tile in `dir` (also turns the player). */
  step(dir: Direction): StepResult {
    const { dx, dy } = DIRECTIONS[dir]
    this.state.facing = dir
    const from = { x: this.state.x, y: this.state.y }
    const to = { x: from.x + dx, y: from.y + dy }

    const tile = this.tileAt(to.x, to.y)
    if (!tile) return { kind: 'blocked', reason: 'edge' }
    if (!tile.walkable) return { kind: 'blocked', reason: 'wall' }
    if (this.entityAt(to.x, to.y)) return { kind: 'blocked', reason: 'entity' }

    const warp = this.warpAt(to.x, to.y)
    if (warp?.requires && !this.hasFlag(warp.requires)) {
      return { kind: 'blocked', reason: 'gate', dialog: warp.blockedDialog ?? ['Du kan inte gå dit ännu.'] }
    }

    this.state.x = to.x
    this.state.y = to.y
    this.state.steps++

    const triggers: Trigger[] = []
    if (warp) {
      triggers.push({ type: 'warp', warp })
      return { kind: 'moved', from, to, triggers }
    }
    for (const trainerId of this.trainersInSight()) triggers.push({ type: 'trainer-sight', trainerId })
    if (tile.encounter) triggers.push({ type: 'grass' })
    return { kind: 'moved', from, to, triggers }
  }

  applyWarp(warp: WarpDef): void {
    this.state.mapId = warp.to
    this.state.x = warp.toX
    this.state.y = warp.toY
    if (warp.facing) this.state.facing = warp.facing
  }

  /** Teleports back to the last used Pokémon Center / home (after a blackout). */
  blackout(): void {
    const { mapId, x, y } = this.state.lastCenter
    this.state.mapId = mapId
    this.state.x = x
    this.state.y = y
    this.state.facing = 'down'
  }

  /** Remembers the outside of the current building as the place to wake up after a blackout. */
  rememberCenter(): void {
    const exit = this.map.warps[0]
    if (exit) this.state.lastCenter = { mapId: exit.to, x: exit.toX, y: exit.toY }
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  interact(): InteractResult {
    const { dx, dy } = DIRECTIONS[this.state.facing]
    let tx = this.state.x + dx
    let ty = this.state.y + dy
    // You can talk across a counter.
    if (this.tileAt(tx, ty)?.kind === 'counter' && !this.entityAt(tx, ty)) {
      tx += dx
      ty += dy
    }
    const entity = this.entityAt(tx, ty)
    if (!entity) return null

    if (entity.kind === 'sign') return { type: 'dialog', lines: entity.sign.text }
    if (entity.kind === 'npc') {
      const npc = entity.npc
      this.npcFacing[npc.id] = OPPOSITE[this.state.facing]
      const lines = npc.dialogAfter && this.hasFlag(npc.dialogAfter.flag) ? npc.dialogAfter.lines : npc.dialog
      return { type: 'dialog', lines, speaker: npc.name, npcId: npc.id, action: npc.action }
    }
    this.npcFacing[entity.spot.id] = OPPOSITE[this.state.facing]
    if (this.isDefeated(entity.spot.id)) {
      return { type: 'dialog', lines: entity.def.defeated, speaker: entity.def.name }
    }
    return { type: 'trainer', trainerId: entity.spot.id }
  }

  // ---------------------------------------------------------------------------
  // Trainers and wild Pokémon
  // ---------------------------------------------------------------------------

  /** Trainers on this map that can currently see the player (straight line, not blocked, not yet beaten). */
  trainersInSight(): string[] {
    const spotted: string[] = []
    for (const spot of this.map.trainers) {
      if (spot.sight <= 0 || this.isDefeated(spot.id)) continue
      const { dx, dy } = DIRECTIONS[spot.facing]
      for (let i = 1; i <= spot.sight; i++) {
        const x = spot.x + dx * i
        const y = spot.y + dy * i
        if (x === this.state.x && y === this.state.y) {
          spotted.push(spot.id)
          break
        }
        if (!this.tileAt(x, y)?.walkable || this.entityAt(x, y)) break
      }
    }
    return spotted
  }

  /** Rolls a wild encounter for the tile the player just stepped on. */
  rollEncounter(): WildEncounter | null {
    const tableId = this.map.encounterTable
    const tile = this.tileAt(this.state.x, this.state.y)
    if (!tableId || !tile?.encounter) return null
    if (this.rng.next() >= this.balance.ENCOUNTER_RATE) return null
    const table = ENCOUNTER_TABLES[tableId]
    if (!table?.length) return null
    const entry = table[Math.max(0, pickWeightedIndex(this.rng, table.map(e => e.weight)))]
    return { speciesId: entry.speciesId, level: randInt(this.rng, entry.minLevel, entry.maxLevel) }
  }
}
