export type TerrainType = 'plains' | 'forest' | 'hills' | 'swamp' | 'mountain' | 'water'

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  plains: 'Slätt',
  forest: 'Skog',
  hills: 'Kullar',
  swamp: 'Träsk',
  mountain: 'Berg',
  water: 'Vatten',
}

/** How much of the 125-point time pool a step onto this terrain costs. Water is impassable. */
export const TERRAIN_MOVE_COST: Record<TerrainType, number> = {
  plains: 5,
  forest: 8,
  hills: 10,
  swamp: 12,
  mountain: 18,
  water: Infinity,
}

export const MAX_PARTY_SIZE = 4

const REGION_SIZE = 6

/**
 * Deterministic hash in [0, 1) for a lattice coordinate - same input always gives
 * the same output, for every player, forever, with nothing stored. This is what
 * makes an "enormous" map free: terrain is computed on demand, never persisted,
 * only the sparse world_pois table holds actual rows.
 */
function regionHash(rx: number, ry: number): number {
  let h = rx * 374761393 + ry * 668265263
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

/**
 * Guaranteed walkable in every direction around the capital - without this, the
 * origin's own REGION_SIZE region can itself hash to water (it did, in testing),
 * stranding the capital on a one-tile island since only the exact spawn point was
 * ever force-set to plains. A radius-based safe zone (rather than forcing just the
 * one origin region) also doesn't care that (0,0) sits at a region's corner
 * instead of its center.
 */
const CAPITAL_SAFE_RADIUS = 3

/**
 * Terrain comes in blocky same-type regions (REGION_SIZE x REGION_SIZE) rather
 * than per-tile noise, so walking around actually feels like crossing a forest or
 * a mountain range instead of static. A v1 placeholder - real value/Perlin noise
 * with octaves would give smoother, more natural-looking region borders later.
 */
export function terrainAt(x: number, y: number): TerrainType {
  if (Math.max(Math.abs(x), Math.abs(y)) <= CAPITAL_SAFE_RADIUS) return 'plains'
  const rx = Math.floor(x / REGION_SIZE)
  const ry = Math.floor(y / REGION_SIZE)
  const v = regionHash(rx, ry)
  if (v < 0.12) return 'water'
  if (v < 0.30) return 'mountain'
  if (v < 0.45) return 'swamp'
  if (v < 0.65) return 'forest'
  if (v < 0.82) return 'hills'
  return 'plains'
}

export type TileEventType = 'nothing' | 'minor_find' | 'hazard' | 'combat'

interface EventWeights {
  nothing: number
  minor_find: number
  hazard: number
  combat: number
}

/**
 * Weighted odds per terrain for what happens when a party steps onto a tile with
 * no point-of-interest. Guessed proportions - tune once we see how adventures
 * actually feel to play, same as every other unvalidated formula this session.
 */
const TERRAIN_EVENT_TABLE: Record<TerrainType, EventWeights> = {
  plains: { nothing: 55, minor_find: 25, hazard: 5, combat: 15 },
  forest: { nothing: 40, minor_find: 20, hazard: 10, combat: 30 },
  hills: { nothing: 40, minor_find: 15, hazard: 15, combat: 30 },
  swamp: { nothing: 30, minor_find: 10, hazard: 30, combat: 30 },
  mountain: { nothing: 25, minor_find: 10, hazard: 30, combat: 35 },
  water: { nothing: 100, minor_find: 0, hazard: 0, combat: 0 },
}

export function rollTileEvent(terrain: TerrainType): TileEventType {
  const weights = TERRAIN_EVENT_TABLE[terrain]
  const total = weights.nothing + weights.minor_find + weights.hazard + weights.combat
  let roll = Math.random() * total
  for (const type of ['nothing', 'minor_find', 'hazard', 'combat'] as const) {
    if (roll < weights[type]) return type
    roll -= weights[type]
  }
  return 'nothing'
}

export type Direction = 'n' | 's' | 'e' | 'w'

export const DIRECTION_LABELS: Record<Direction, string> = {
  n: 'Norr',
  s: 'Söder',
  e: 'Öster',
  w: 'Väster',
}

export function stepDirection(x: number, y: number, dir: Direction): { x: number, y: number } {
  if (dir === 'n') return { x, y: y - 1 }
  if (dir === 's') return { x, y: y + 1 }
  if (dir === 'e') return { x: x + 1, y }
  return { x: x - 1, y }
}
