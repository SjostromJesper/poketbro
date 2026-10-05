// The theme engine (pure): turns a logical map tile into the stack of pieces a theme draws for it.
// Themes are data (see types.ts); everything that depends on neighbours (autotiles, tree pairs, building slices) is here.
import { buildingAt, FOOTPRINT } from '../buildings'
import type { MapDef } from '../types'
import { spriteSize, type Autotile, type Fill, type Layer, type Ref, type ThemeManifest, type ThemeTiles, type TreeDef } from './types'

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

export { hash }

/** Moves a reference by whole tiles inside its sheet and gives it a size. */
export function offset(ref: Ref, dx: number, dy: number, w?: number, h?: number): Ref {
  return { sheet: ref.sheet, tx: ref.tx + dx, ty: ref.ty + dy, ...(w ? { w } : {}), ...(h ? { h } : {}) }
}

// ---------------------------------------------------------------------------
// Autotiles
// ---------------------------------------------------------------------------

/**
 * The piece (relative to the autotile origin) for a tile whose four neighbours are or are not of the same kind.
 * Block-only autotiles have no strips, so one-tile-wide runs use the centre piece.
 * Diagonals are ignored (no inner corners).
 */
export function autotilePiece(up: boolean, down: boolean, left: boolean, right: boolean, strips = true): { col: number, row: number } {
  if (strips) {
    if (!up && !down && !left && !right) return { col: 3, row: 3 }
    if (!left && !right) return { col: 3, row: !up ? 0 : !down ? 2 : 1 }
    if (!up && !down) return { col: !left ? 0 : !right ? 2 : 1, row: 3 }
  }
  // Block pieces. Without strips, a run one tile wide uses the centre column (or row) so it does not get both rims.
  const narrowX = !strips && !left && !right
  const narrowY = !strips && !up && !down
  return { col: narrowX ? 1 : !left ? 0 : !right ? 2 : 1, row: narrowY ? 1 : !up ? 0 : !down ? 2 : 1 }
}

/** Is the tile of `kind`? Outside the map counts as the same kind, so paths and lakes run off the edge without a rim. */
function same(map: Pick<MapDef, 'tiles'>, tx: number, ty: number, char: string): boolean {
  const row = map.tiles[ty]
  if (row === undefined || tx < 0 || tx >= row.length) return true
  return row[tx] === char
}

function isAutotile(value: Autotile | Fill | Ref): value is Autotile {
  return 'origin' in value
}

function isFill(value: Autotile | Fill | Ref): value is Fill {
  return 'fill' in value
}

function autotileLayers(tiles: ThemeTiles, def: Autotile | Fill | Ref, map: Pick<MapDef, 'tiles'>, tx: number, ty: number, char: string, doorBelow = false): Layer[] {
  const up = same(map, tx, ty - 1, char)
  const down = same(map, tx, ty + 1, char) || doorBelow
  const left = same(map, tx - 1, ty, char)
  const right = same(map, tx + 1, ty, char)
  if (isFill(def)) {
    const layers: Layer[] = [def.fill]
    if (!(up && down && left && right)) layers.push({ edges: { up: !up, down: !down, left: !left, right: !right, color: def.edge } })
    return layers
  }
  if (!isAutotile(def)) return [def]
  const p = autotilePiece(up, down, left, right, def.strips)
  const layers: Layer[] = []
  if (def.under === 'ground') layers.push(tiles.ground[0])
  layers.push(offset(def.origin, p.col, p.row))
  return layers
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

function isTree(map: Pick<MapDef, 'tiles'>, tx: number, ty: number): boolean {
  return map.tiles[ty]?.[tx] === '#'
}

/** One tree tile: along a row of tree tiles they pair up from the left end, a vertical run pairs up from the bottom. */
export function treeLayer(def: TreeDef, map: Pick<MapDef, 'tiles'>, tx: number, ty: number): Ref {
  const bush = (): Ref => def.bushes[hash(tx, ty) % def.bushes.length]
  if (def.kind === '1x1') return def.variants[hash(tx, ty) % def.variants.length]
  const wide = def.kind === '2x2'
  let start = tx
  while (isTree(map, start - 1, ty)) start--
  let end = tx
  while (isTree(map, end + 1, ty)) end++
  const length = end - start + 1
  const index = tx - start
  if (wide && (length === 1 || (length % 2 === 1 && index === length - 1))) return bush()
  const right = wide ? index % 2 : 0
  const leftX = tx - right
  let fromBottom = 0
  while (isTree(map, leftX, ty + fromBottom + 1)) fromBottom++
  const canopyRow = fromBottom % 2 === 1
  if (!wide && !canopyRow && !isTree(map, tx, ty - 1)) {
    // A single-height row of 1x2 trees: just the trunk half does not look like a tree, use a bush.
    return bush()
  }
  const variant = def.variants[hash(leftX, ty + (canopyRow ? 1 : 0)) % def.variants.length]
  return offset(variant, right, canopyRow ? 0 : 1)
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export function groundLayer(tiles: ThemeTiles, tx: number, ty: number): Ref {
  const h = hash(tx, ty)
  if (tiles.ground.length === 1 || h % 5 < 3) return tiles.ground[0]
  return tiles.ground[1 + (h % (tiles.ground.length - 1))]
}

export interface DescribeOptions {
  /** Animation frame (changes about every 450 ms). */
  frame: number
}

type MapView = Pick<MapDef, 'tiles' | 'indoor' | 'buildings' | 'floor'>

/**
 * The layers (bottom to top) for one map tile. An empty array means "not covered by the theme": the renderer then falls back
 * to its built-in drawing for that tile (indoor walls and mats of themes that have no pieces for them).
 */
export function describeTile(theme: Pick<ThemeManifest, 'tiles'>, map: MapView, tx: number, ty: number, options: DescribeOptions = { frame: 0 }): Layer[] {
  const t = theme.tiles
  const char = map.tiles[ty]?.[tx]
  if (char === undefined) return []
  const { frame } = options

  if (map.indoor) {
    const floors = map.floor === 'stone' ? t.floorStone : t.floor
    const floor = floors[hash(tx, ty) % floors.length]
    switch (char) {
      case 'F': return [floor]
      case 'T': return [floor, t.counter]
      case 'M': return t.mat ? [floor, t.mat] : [floor, { badge: 'mat' }]
      case '#': {
        const faceVisible = map.tiles[ty + 1]?.[tx] !== '#'
        const wall = faceVisible ? t.wall : t.wallTop
        return wall ? [wall] : []
      }
      default: return []
    }
  }

  switch (char) {
    case '.': return [groundLayer(t, tx, ty)]
    case ',': return [t.ground[0], t.tallGrass.frames[frame % t.tallGrass.frames.length]]
    case '#': return [t.ground[0], treeLayer(t.trees, map, tx, ty)]
    case 'o': {
      const look = t.flowers[hash(tx, ty) % t.flowers.length]
      return [groundLayer(t, tx, ty), look[frame % look.length]]
    }
    case 'f': return [groundLayer(t, tx, ty), t.fence]
    case 'S': return [groundLayer(t, tx, ty), t.sign]
    case '=': return autotileLayers(t, t.path, map, tx, ty, '=', map.tiles[ty + 1]?.[tx] === 'D')
    case '~': {
      const layers = autotileLayers(t, t.water, map, tx, ty, '~')
      const open = same(map, tx, ty - 1, '~') && same(map, tx, ty + 1, '~') && same(map, tx - 1, ty, '~') && same(map, tx + 1, ty, '~')
      if (open && t.ripples) layers.push(t.ripples[(frame + hash(tx, ty)) % t.ripples.length])
      return layers
    }
    case 'R': case 'W': case 'D': {
      const hit = buildingAt(map, tx, ty)
      if (!hit) return []
      const sprite = t.buildings[hit.placement.kind]
      const { w, h } = spriteSize(sprite)
      const offX = FOOTPRINT.door - sprite.door
      const offY = FOOTPRINT.h - h
      const sx = hit.dx - offX
      const sy = hit.dy - offY
      const layers: Layer[] = [groundLayer(t, tx, ty)]
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
        if ('ref' in sprite) layers.push(offset(sprite.ref, sx, sy, 1, 1))
        else if ('grid' in sprite) layers.push(sprite.grid[sy][sx])
        else layers.push({ house: { ...sprite.paint, dx: sx, dy: sy } })
        // Signs go on the top row of the sprite, above the door.
        if (sprite.badge && sy === 0 && hit.dx === FOOTPRINT.door) layers.push({ badge: sprite.badge })
      } else {
        layers.push(t.hedge)
      }
      return layers
    }
    default: return []
  }
}
