// Maps tile characters (see tiles.ts) to sprites in the Ninja Adventure tile sheets (CC0, by pixel-boy), pure TypeScript.
// `describeTile` says which 16x16 pieces to stack for one map tile; the canvas renderer only has to draw them.
// Water and dirt paths are autotiled: the piece depends on which of the four neighbours are the same kind.
import type { MapDef } from './types'

export type SheetId = 'floor' | 'nature' | 'house' | 'water' | 'interiorFloor' | 'ripples' | 'plant'

/** Sheet files (copied by `npm run copy-graphics`) and their size in 16x16 tiles, so coordinates can be checked. */
export const SHEETS: Record<SheetId, { src: string, cols: number, rows: number }> = {
  floor: { src: '/assets/nudge/tiles/floor.png', cols: 22, rows: 26 },
  nature: { src: '/assets/nudge/tiles/nature.png', cols: 24, rows: 21 },
  house: { src: '/assets/nudge/tiles/house.png', cols: 33, rows: 23 },
  water: { src: '/assets/nudge/tiles/water.png', cols: 28, rows: 17 },
  interiorFloor: { src: '/assets/nudge/tiles/interior-floor.png', cols: 22, rows: 17 },
  ripples: { src: '/assets/nudge/tiles/ripples.png', cols: 4, rows: 1 },
  plant: { src: '/assets/nudge/tiles/plant.png', cols: 4, rows: 1 },
}

/** One 16x16 piece of a sheet (tile coordinates), or a procedurally drawn badge on top of a building. */
export type TileLayer =
  | { sheet: SheetId, tx: number, ty: number }
  | { badge: 'cross' | 'bag' | 'dojo' | 'mat' }

const piece = (sheet: SheetId, tx: number, ty: number): TileLayer => ({ sheet, tx, ty })

// ---------------------------------------------------------------------------
// Buildings: sprites of the house sheet, drawn tile by tile (the map's ASCII keeps the collision)
// ---------------------------------------------------------------------------

export type BuildingKind = 'houseOrange' | 'houseCream' | 'houseOrange2' | 'houseRed' | 'lab' | 'center' | 'mart' | 'gym'

export interface BuildingSprite {
  /** Top-left tile of the sprite in the house sheet. */
  tx: number
  ty: number
  w: number
  h: number
  /** Column of the door (relative to the building), always on the bottom row. */
  door: number
  /** Extra marks that make Pokémon buildings recognisable. */
  badge?: 'cross' | 'bag' | 'dojo'
}

export const BUILDINGS: Record<BuildingKind, BuildingSprite> = {
  houseOrange: { tx: 0, ty: 0, w: 4, h: 3, door: 1 },
  houseCream: { tx: 4, ty: 0, w: 4, h: 3, door: 1 },
  houseOrange2: { tx: 8, ty: 0, w: 4, h: 3, door: 1 },
  houseRed: { tx: 12, ty: 0, w: 4, h: 3, door: 1 },
  lab: { tx: 26, ty: 0, w: 3, h: 3, door: 1 },
  center: { tx: 23, ty: 0, w: 3, h: 3, door: 1, badge: 'cross' },
  mart: { tx: 16, ty: 0, w: 3, h: 3, door: 1, badge: 'bag' },
  gym: { tx: 19, ty: 0, w: 4, h: 3, door: 2, badge: 'dojo' },
}

export interface BuildingPlacement {
  kind: BuildingKind
  /** Top-left tile on the map. */
  x: number
  y: number
}

/** The tile of the building door on the map. */
export function doorOf(placement: BuildingPlacement): { x: number, y: number } {
  const sprite = BUILDINGS[placement.kind]
  return { x: placement.x + sprite.door, y: placement.y + sprite.h - 1 }
}

export function buildingAt(map: Pick<MapDef, 'buildings'>, tx: number, ty: number): { placement: BuildingPlacement, sprite: BuildingSprite, dx: number, dy: number } | null {
  for (const placement of map.buildings ?? []) {
    const sprite = BUILDINGS[placement.kind]
    const dx = tx - placement.x
    const dy = ty - placement.y
    if (dx >= 0 && dy >= 0 && dx < sprite.w && dy < sprite.h) return { placement, sprite, dx, dy }
  }
  return null
}

// ---------------------------------------------------------------------------
// Autotiling (water and dirt paths)
// ---------------------------------------------------------------------------

/**
 * The sheets lay out every autotile as 4x4 pieces: a 3x3 block (corners, edges, centre) in columns 0-2 / rows 0-2,
 * a vertical strip in column 3 (rows 0-2: top, middle, bottom), a horizontal strip in row 3 (columns 0-2: left, middle, right)
 * and a single "island" piece at (3, 3). This returns the piece (relative to the autotile's origin) for a tile
 * whose four neighbours are or are not the same kind. Diagonals are ignored (no inner corners).
 */
export function autotilePiece(up: boolean, down: boolean, left: boolean, right: boolean): { col: number, row: number } {
  if (!up && !down && !left && !right) return { col: 3, row: 3 }
  if (!left && !right) return { col: 3, row: !up ? 0 : !down ? 2 : 1 }
  if (!up && !down) return { col: !left ? 0 : !right ? 2 : 1, row: 3 }
  return { col: !left ? 0 : !right ? 2 : 1, row: !up ? 0 : !down ? 2 : 1 }
}

/** Origin of each autotile in its sheet. */
const AUTOTILE = {
  path: { sheet: 'floor' as const, ox: 0, oy: 7 },
  water: { sheet: 'water' as const, ox: 0, oy: 6 },
}

/** Is the tile at (tx, ty) of `kind`? Outside the map counts as the same kind, so a path or lake runs off the edge without a rim. */
function same(map: Pick<MapDef, 'tiles'>, tx: number, ty: number, char: string): boolean {
  const row = map.tiles[ty]
  if (row === undefined || tx < 0 || tx >= row.length) return true
  return row[tx] === char
}

function neighbours(map: Pick<MapDef, 'tiles'>, tx: number, ty: number, char: string) {
  return {
    up: same(map, tx, ty - 1, char),
    down: same(map, tx, ty + 1, char),
    left: same(map, tx - 1, ty, char),
    right: same(map, tx + 1, ty, char),
  }
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Plain grass with now and then a tuft. */
const GRASS_TUFTS: [number, number][] = [[1, 12], [2, 12], [3, 12], [4, 12], [2, 11], [3, 11]]
const GRASS_FILL: [number, number] = [0, 12]

function grass(tx: number, ty: number): TileLayer {
  const h = hash(tx, ty)
  if (h % 5 < 3) return piece('floor', ...GRASS_FILL)
  const [x, y] = GRASS_TUFTS[h % GRASS_TUFTS.length]
  return piece('floor', x, y)
}

/** Tall grass: two spiky tufts that sway between two pieces. */
const TALL_GRASS: [[number, number], [number, number]][] = [[[4, 10], [5, 10]], [[8, 10], [9, 10]], [[3, 10], [4, 10]]]

function isTree(map: Pick<MapDef, 'tiles'>, tx: number, ty: number): boolean {
  return map.tiles[ty]?.[tx] === '#'
}

/** Single bushes (1x1) for trees that have no neighbour to pair up with. */
const BUSHES: [number, number][] = [[0, 10], [1, 10], [2, 10]]

function treeLayer(map: Pick<MapDef, 'tiles'>, tx: number, ty: number): TileLayer {
  // A tree is 2x2 pieces (canopy on top, trunk below). Along a row of tree tiles they pair up from the left end of the run,
  // and a vertical run pairs up from the bottom (trunk row, canopy row, trunk row, ...). A tile with no partner is a small bush.
  let start = tx
  while (isTree(map, start - 1, ty)) start--
  let end = tx
  while (isTree(map, end + 1, ty)) end++
  const length = end - start + 1
  const index = tx - start
  if (length === 1 || (length % 2 === 1 && index === length - 1)) return piece('nature', ...BUSHES[hash(tx, ty) % BUSHES.length])
  const right = index % 2
  // Both halves of a tree follow the left column's vertical run, so they always match.
  const leftX = tx - right
  let fromBottom = 0
  while (isTree(map, leftX, ty + fromBottom + 1)) fromBottom++
  const canopyRow = fromBottom % 2 === 1
  const variant = hash(leftX, ty + (canopyRow ? 1 : 0)) % 5 < 3 ? 0 : 2
  return piece('nature', variant + right, canopyRow ? 0 : 1)
}

export interface DescribeOptions {
  /** Animation frame (changes about every 450 ms). */
  frame: number
}

/**
 * The layers (bottom to top) for one map tile. An empty array means "not covered by the tileset": the renderer then
 * falls back to its built-in drawing for that tile (used for indoor walls and mats).
 */
export function describeTile(map: Pick<MapDef, 'tiles' | 'indoor' | 'buildings' | 'floor'>, tx: number, ty: number, options: DescribeOptions = { frame: 0 }): TileLayer[] {
  const char = map.tiles[ty]?.[tx]
  if (char === undefined) return []
  const { frame } = options

  if (map.indoor) {
    const dark = map.floor === 'stone'
    // The plain brick pieces inside the sheet's rug frames tile seamlessly: pale for homes, grey-green for the gym.
    const floor = dark ? piece('interiorFloor', 12, 7) : piece('interiorFloor', 1, 1)
    switch (char) {
      case 'F': return [floor]
      case 'T': return [floor, piece('house', 18, 18)]
      case 'M': return [floor, { badge: 'mat' }]
      default: return []
    }
  }

  switch (char) {
    case '.': return [grass(tx, ty)]
    case ',': {
      const pair = TALL_GRASS[hash(tx, ty) % TALL_GRASS.length]
      const [x, y] = pair[frame % 2]
      return [piece('floor', ...GRASS_FILL), piece('nature', x, y)]
    }
    case '#': return [piece('floor', ...GRASS_FILL), treeLayer(map, tx, ty)]
    case 'o': {
      const h = hash(tx, ty) % 3
      if (h === 0) return [grass(tx, ty), piece('plant', frame % 4, 0)]
      return [grass(tx, ty), piece('nature', h === 1 ? 0 : 3, 11)]
    }
    case 'f': return [grass(tx, ty), piece('house', 10, 5)]
    case 'S': return [grass(tx, ty), piece('house', 3, 3)]
    case '=': {
      const n = neighbours(map, tx, ty, '=')
      // A path touching a door counts as connected to it (so the path reaches the building without a rim).
      const p = autotilePiece(n.up, n.down || map.tiles[ty + 1]?.[tx] === 'D', n.left, n.right)
      return [piece(AUTOTILE.path.sheet, AUTOTILE.path.ox + p.col, AUTOTILE.path.oy + p.row)]
    }
    case '~': {
      const n = neighbours(map, tx, ty, '~')
      const p = autotilePiece(n.up, n.down, n.left, n.right)
      // The open water in the middle ripples.
      if (p.col === 1 && p.row === 1) return [piece('water', AUTOTILE.water.ox + 1, AUTOTILE.water.oy + 1), piece('ripples', (frame + hash(tx, ty)) % 4, 0)]
      return [piece(AUTOTILE.water.sheet, AUTOTILE.water.ox + p.col, AUTOTILE.water.oy + p.row)]
    }
    case 'R': case 'W': case 'D': {
      const hit = buildingAt(map, tx, ty)
      if (!hit) return []
      const { sprite, dx, dy } = hit
      const layers: TileLayer[] = [grass(tx, ty), piece('house', sprite.tx + dx, sprite.ty + dy)]
      // Badges sit on the roof row, above the door.
      if (sprite.badge && dy === 0 && dx === sprite.door) layers.push({ badge: sprite.badge })
      return layers
    }
    default: return []
  }
}
