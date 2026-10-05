// A small API to write maps with (PLAN-3 4.2) instead of character matrices. A map is built with calls like fill, path, blob (organic
// patches), scatter, building, warp, npc, trainer and sign, and compiled to the same `MapDef` the game has always used (ASCII tiles +
// entity lists + building placements). Everything is deterministic (seeded), so a map looks the same every time.
import { createRng, type Rng } from '../engine/rng'
import type { MusicId } from './audio-manifest'
import { FOOTPRINT, type BuildingKind } from './buildings'
import { TILES } from './tiles'
import type { Direction, MapDef, NpcDef, PickupDef, SignDef, TrainerSpot, WarpDef } from './types'

/** Names for tile characters, so maps read like text. Single characters can be used directly too. */
export const TILE_ALIASES: Record<string, string> = {
  ground: '.', grass: ',', tree: '#', water: '~', path: '=', flowers: 'o', fence: 'f', sand: 's', ledge: 'L', rock: '^', cave: 'c',
  cavewall: 'X', stairs: 'A', floor: 'F', wall: '#', counter: 'T', mat: 'M', shelf: 'H', table: 'B', bed: 'K', roof: 'R', house: 'W', door: 'D',
}

export interface MapOptions {
  name: string
  /** What the map is filled with at first (default ground, or floor indoors). */
  base?: string
  music?: MusicId
  encounterTable?: string
  fishingTable?: string
  indoor?: boolean
  floor?: 'wood' | 'stone'
}

export interface DoorOptions {
  to: string
  toX: number
  toY: number
  facing?: Direction
  requiresBadges?: number
  blockedDialog?: string[]
}

export type TrainerPlacement = Omit<TrainerSpot, 'sight'> & { sight?: number }

export class MapBuilder {
  readonly id: string
  readonly width: number
  readonly height: number
  private readonly options: MapOptions
  private readonly grid: string[][]
  private readonly warps: WarpDef[] = []
  private readonly npcs: NpcDef[] = []
  private readonly trainers: TrainerSpot[] = []
  private readonly signs: SignDef[] = []
  private readonly pickups: PickupDef[] = []
  private readonly buildings: { kind: BuildingKind, x: number, y: number }[] = []
  private readonly rng: Rng

  constructor(id: string, width: number, height: number, options: MapOptions) {
    this.id = id
    this.width = width
    this.height = height
    this.options = options
    this.rng = createRng(hashString(id))
    const base = this.char(options.base ?? (options.indoor ? 'F' : '.'))
    this.grid = Array.from({ length: height }, () => Array.from({ length: width }, () => base))
  }

  private char(tile: string): string {
    const c = TILE_ALIASES[tile] ?? tile
    if (c.length !== 1 || !TILES[c]) throw new Error(`${this.id}: unknown tile "${tile}"`)
    return c
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  private put(x: number, y: number, c: string): void {
    if (this.inside(x, y)) this.grid[y][x] = c
  }

  /** The tile character at a position (for decisions while building). */
  at(x: number, y: number): string {
    return this.inside(x, y) ? this.grid[y][x] : '#'
  }

  /** Fills a rectangle. */
  fill(x: number, y: number, w: number, h: number, tile: string): this {
    const c = this.char(tile)
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, c)
    return this
  }

  /** A frame of `thickness` tiles around the whole map. */
  border(tile: string, thickness = 1): this {
    for (let t = 0; t < thickness; t++) {
      this.fill(0, t, this.width, 1, tile).fill(0, this.height - 1 - t, this.width, 1, tile)
      this.fill(t, 0, 1, this.height, tile).fill(this.width - 1 - t, 0, 1, this.height, tile)
    }
    return this
  }

  /**
   * A path through the given points (`[x, y]` pairs). Between two points it goes along x first and then along y (L-shaped), `width`
   * tiles wide, with `wobble` (0-1) now and then shifting a stretch by one tile, so roads wind a little instead of running straight.
   */
  path(points: [number, number][], options: { width?: number, tile?: string, wobble?: number } = {}): this {
    const width = options.width ?? 2
    const c = this.char(options.tile ?? '=')
    const wobble = options.wobble ?? 0
    const stamp = (x: number, y: number, horizontal: boolean) => {
      for (let k = 0; k < width; k++) this.put(horizontal ? x : x + k, horizontal ? y + k : y, c)
    }
    for (let i = 0; i + 1 < points.length; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[i + 1]
      let x = x0
      let y = y0
      let shift = 0
      const stepX = Math.sign(x1 - x0)
      while (x !== x1) {
        if (wobble && this.rng.next() < wobble * 0.2) shift = Math.max(-1, Math.min(1, shift + (this.rng.next() < 0.5 ? -1 : 1)))
        stamp(x, y + shift, true)
        if (shift !== 0) stamp(x, y, true)
        x += stepX
      }
      stamp(x1, y + 0, true)
      const stepY = Math.sign(y1 - y0)
      shift = 0
      while (y !== y1) {
        if (wobble && this.rng.next() < wobble * 0.2) shift = Math.max(-1, Math.min(1, shift + (this.rng.next() < 0.5 ? -1 : 1)))
        stamp(x1 + shift, y, false)
        if (shift !== 0) stamp(x1, y, false)
        y += stepY
      }
      stamp(x1, y1, false)
      stamp(x1, y1, true)
    }
    return this
  }

  /** An organic patch (an ellipse with a rough edge): grass fields, ponds, sand banks. `roughness` 0 is a clean ellipse. */
  blob(cx: number, cy: number, rx: number, ry: number, tile: string, options: { roughness?: number, onlyOn?: string } = {}): this {
    const c = this.char(tile)
    const only = options.onlyOn ? [...options.onlyOn].map(o => this.char(o)) : null
    const roughness = options.roughness ?? 0.25
    // A smooth radius wobble around the ellipse: a few random harmonics.
    const phases = [this.rng.next() * 6.28, this.rng.next() * 6.28, this.rng.next() * 6.28]
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        const angle = Math.atan2(dy, dx)
        const wobble = 1 + roughness * (0.5 * Math.sin(2 * angle + phases[0]) + 0.3 * Math.sin(3 * angle + phases[1]) + 0.2 * Math.sin(5 * angle + phases[2]))
        if (Math.hypot(dx, dy) <= wobble && this.inside(x, y) && (!only || only.includes(this.grid[y][x]))) this.put(x, y, c)
      }
    }
    return this
  }

  /** Sprinkles `count` tiles at random places of a rectangle (flowers, single trees, rocks), only on tiles of `onlyOn` (default: ground). */
  scatter(x: number, y: number, w: number, h: number, tile: string, count: number, options: { onlyOn?: string } = {}): this {
    const c = this.char(tile)
    const only = [...(options.onlyOn ?? '.')].map(o => this.char(o))
    let placed = 0
    for (let attempt = 0; attempt < count * 20 && placed < count; attempt++) {
      const px = x + Math.floor(this.rng.next() * w)
      const py = y + Math.floor(this.rng.next() * h)
      if (this.inside(px, py) && only.includes(this.grid[py][px])) {
        this.put(px, py, c)
        placed++
      }
    }
    return this
  }

  /** A row of ledge tiles (jump down only). */
  ledge(x: number, y: number, length: number): this {
    return this.fill(x, y, length, 1, 'ledge')
  }

  /**
   * A building: the 5 x 4 footprint with the top-left corner at (x, y), a door in the middle of the bottom row that warps to `door.to`.
   * The ASCII below is roof (top row), wall, wall, wall with the door.
   */
  building(kind: BuildingKind, x: number, y: number, door: DoorOptions): this {
    for (let dy = 0; dy < FOOTPRINT.h; dy++) {
      for (let dx = 0; dx < FOOTPRINT.w; dx++) {
        const isDoor = dy === FOOTPRINT.h - 1 && dx === FOOTPRINT.door
        this.put(x + dx, y + dy, isDoor ? 'D' : dy === 0 ? 'R' : 'W')
      }
    }
    this.buildings.push({ kind, x, y })
    this.warp(x + FOOTPRINT.door, y + FOOTPRINT.h - 1, door.to, door.toX, door.toY, door)
    return this
  }

  warp(x: number, y: number, to: string, toX: number, toY: number, options: Partial<Pick<WarpDef, 'facing' | 'requires' | 'requiresBadges' | 'blockedDialog'>> = {}): this {
    this.warps.push({ x, y, to, toX, toY, ...options })
    return this
  }

  /** A warp tile at the edge of the map (a road leaving the map) - it also makes sure the tile is walkable ground. */
  exit(x: number, y: number, to: string, toX: number, toY: number, options: Partial<Pick<WarpDef, 'facing' | 'requires' | 'requiresBadges' | 'blockedDialog'>> = {}): this {
    return this.warp(x, y, to, toX, toY, options)
  }

  npc(def: NpcDef): this {
    this.npcs.push(def)
    return this
  }

  trainer(spot: TrainerPlacement): this {
    this.trainers.push({ sight: 3, ...spot })
    return this
  }

  sign(x: number, y: number, text: string[]): this {
    this.put(x, y, 'S')
    this.signs.push({ x, y, text })
    return this
  }

  pickup(def: PickupDef): this {
    this.pickups.push(def)
    return this
  }

  /** The compiled map. Throws when something stands on a tile it cannot stand on, so mistakes show up at once. */
  build(): MapDef {
    const tiles = this.grid.map(row => row.join(''))
    const map: MapDef = {
      id: this.id,
      name: this.options.name,
      tiles,
      warps: this.warps,
      npcs: this.npcs,
      trainers: this.trainers,
      signs: this.signs,
      ...(this.options.music ? { music: this.options.music } : {}),
      ...(this.options.encounterTable ? { encounterTable: this.options.encounterTable } : {}),
      ...(this.options.fishingTable ? { fishingTable: this.options.fishingTable } : {}),
      ...(this.options.indoor ? { indoor: true } : {}),
      ...(this.options.floor ? { floor: this.options.floor } : {}),
      ...(this.buildings.length ? { buildings: this.buildings } : {}),
      ...(this.pickups.length ? { pickups: this.pickups } : {}),
    }
    const walkable = (x: number, y: number) => {
      const c = tiles[y]?.[x]
      return c !== undefined && TILES[c]?.walkable === true
    }
    for (const n of this.npcs) if (!walkable(n.x, n.y)) this.fail(`NPC ${n.id} stands on a blocked tile at ${n.x},${n.y} (${tiles[n.y]?.[n.x]})`)
    for (const t of this.trainers) if (!walkable(t.x, t.y)) this.fail(`trainer ${t.id} stands on a blocked tile at ${t.x},${t.y} (${tiles[t.y]?.[t.x]})`)
    for (const p of this.pickups) if (!walkable(p.x, p.y)) this.fail(`pickup ${p.id} lies on a blocked tile at ${p.x},${p.y}`)
    for (const w of this.warps) if (tiles[w.y]?.[w.x] === undefined) this.fail(`warp at ${w.x},${w.y} is outside the map`)
    return map
  }

  private fail(message: string): never {
    throw new Error(`${this.id}: ${message}`)
  }
}

export function mapBuilder(id: string, width: number, height: number, options: MapOptions): MapBuilder {
  return new MapBuilder(id, width, height, options)
}

/** An indoor room: walls around, floor inside, a mat in the middle of the bottom wall that leads outside. */
export function room(id: string, width: number, height: number, options: Omit<MapOptions, 'indoor' | 'base'> & { exit: { to: string, toX: number, toY: number } }): MapBuilder {
  const { exit, ...rest } = options
  const m = new MapBuilder(id, width, height, { ...rest, indoor: true, base: 'F' })
  m.border('#')
  const x = Math.floor(width / 2) - 1
  m.fill(x, height - 1, 1, 1, 'M')
  m.warp(x, height - 1, exit.to, exit.toX, exit.toY, { facing: 'down' })
  return m
}

function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
