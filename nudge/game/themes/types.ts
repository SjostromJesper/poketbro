// Graphics themes (PLAN-3 1): everything the overworld draws comes from a theme manifest, which is plain data.
// The logical map (collision, grass, warps) is the same in every theme; a theme only decides how it looks.
import type { Direction } from '../types'

export interface CreditEntry {
  title: string
  by: string
  what: string
  license: string
  url: string
  /** Entries that need attribution (CC-BY / CC-BY-SA) are marked so the credits screen can say so. */
  attribution?: boolean
}

export type ThemeId = 'tuxemon' | 'ninja' | 'pipoya' | 'kenney'

/** Names of the character looks the game asks for. Each theme maps every one of them to one of its sprite sheets. */
export const SPRITE_KEYS = [
  'player', 'player2', 'rival', 'professor', 'nurse', 'clerk', 'mum', 'old', 'boy', 'girl', 'youngster', 'lass', 'bugcatcher', 'hiker', 'fisher',
  'sailor', 'picnicker', 'scientist', 'karate', 'psychic', 'leader1', 'leader2', 'leader3', 'leader4',
] as const
export type SpriteKey = (typeof SPRITE_KEYS)[number]

/** A sheet image. `tileSize` is the size in pixels of one tile of this sheet (16 or 32). */
export interface SheetDef {
  src: string
  tileSize: number
  /** Size in tiles; checked against the PNG by the tests. */
  cols: number
  rows: number
}

/** A rectangle of tiles in a sheet, drawn into `w` x `h` map tiles (default 1x1). */
export interface Ref {
  sheet: string
  tx: number
  ty: number
  w?: number
  h?: number
}

/** One thing drawn on a tile: a piece of a sheet, or a small sign painted with canvas (see ninjaRenderer's badges). */
/** `edges` paints a darker rim along the sides where the neighbour is another kind (for fill tiles without edge pieces). */
export type Layer = Ref | { badge: Badge } | { solid: string } | { house: HousePaint & { dx: number, dy: number } } | { edges: { up: boolean, down: boolean, left: boolean, right: boolean, color: string } }
export type Badge = 'cross' | 'bag' | 'dojo' | 'mat'

/** A plain fill tile for a region (path, water). Edges are painted procedurally in `edge` colour. */
export interface Fill {
  /** A sheet piece, or a plain colour for themes without a water tile. */
  fill: Ref | { solid: string }
  edge: string
}

/**
 * An autotile: pieces for a region of one kind, picked from the four neighbours. `origin` is the top-left piece of a
 * 3x3 block (corners, edges, centre). With `strips` the 4x4 layout of the Ninja sheets is used instead (3x3 block, a
 * vertical strip in column 3, a horizontal strip in row 3 and an island piece at (3, 3)).
 * `under` is drawn first (the pieces of block-only autotiles have transparent corners, so they sit on grass).
 */
export interface Autotile {
  origin: Ref
  strips?: boolean
  under?: 'ground'
  /** Optional edge shading painted by the renderer where a neighbour is another kind (themes without edge pieces). */
  shade?: string
}

/** Tree sprites. '2x2' trees pair up along a run of tree tiles, '1x2' trees are a canopy over a trunk, '1x1' ones are single pieces. */
export interface TreeDef {
  kind: '2x2' | '1x2' | '1x1'
  /** Top-left piece of each variant (2x2: the other three follow to the right and below; 1x2: the one below). */
  variants: Ref[]
  /** Single pieces for trees without a partner. */
  bushes: Ref[]
}

/** Colours for a house painted with canvas (themes with no building sprites). The renderer draws roof, walls, windows and door. */
export interface HousePaint {
  roof: string
  wall: string
  trim: string
}

/**
 * A building drawn inside the logical footprint (5 x 4 tiles): a sprite rectangle of the sheet, a grid of tiles (modular
 * tilesets like Kenney's) or a painted house. Its size must fit the footprint and its door must line up (see `FOOTPRINT`).
 */
export type BuildingSprite = (
  | { ref: Required<Pick<Ref, 'w' | 'h'>> & Ref }
  | { grid: Ref[][] }
  | { paint: HousePaint, w: number, h: number }
) & {
  /** Column of the door inside the sprite. */
  door: number
  /** Painted signs for themes whose building sprite does not show what it is. */
  badge?: 'cross' | 'bag' | 'dojo'
}

/** Size of a building sprite in tiles. */
export function spriteSize(sprite: BuildingSprite): { w: number, h: number } {
  if ('ref' in sprite) return { w: sprite.ref.w, h: sprite.ref.h }
  if ('grid' in sprite) return { w: sprite.grid[0].length, h: sprite.grid.length }
  return { w: sprite.w, h: sprite.h }
}

export interface ThemeTiles {
  /** Plain ground pieces: the first is the common one, the others are sprinkled in now and then. */
  ground: Ref[]
  /** Tall grass: base ground plus one tuft layer per animation frame. */
  tallGrass: { frames: Ref[] }
  path: Autotile | Fill | Ref
  water: Autotile | Fill | Ref
  /** Optional ripple frames drawn over open water. */
  ripples?: Ref[]
  trees: TreeDef
  /** Each entry is one flower look; entries with several refs animate (one per frame). */
  flowers: Ref[][]
  fence: Ref
  sign: Ref
  /** Ground of indoor maps (wood-coloured, and dark stone for gyms). */
  floor: Ref[]
  floorStone: Ref[]
  counter: Ref
  /** The wall seen from inside the room, and the top of a thick wall. Missing: the renderer's placeholder wall. */
  wall?: Ref
  wallTop?: Ref
  /** Outdoor tiles with something to stand on or in (mat in front of doors). */
  mat?: Ref
  /** Tiles of the world maps (PLAN-3). A theme that lacks one gets the neutral placeholder drawing for it (with one warning). */
  sand?: Ref
  rock?: Ref
  ledge?: Ref
  caveFloor?: Ref
  caveWall?: Ref
  stairs?: Ref
  shelf?: Ref
  table?: Ref
  bed?: Ref
  /** Fills the leftover tiles of a building's footprint when its sprite is smaller (a garden bush). */
  hedge: Ref
  buildings: Record<BuildingKind, BuildingSprite>
}

export type BuildingKind = 'houseA' | 'houseB' | 'houseC' | 'houseD' | 'lab' | 'center' | 'mart' | 'gym'

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/**
 * How a character sheet is laid out. `rows`: one row per direction and the walk frames across; `cols`: one column per
 * direction and the frames down (Ninja Adventure). `cycle` lists the frame indexes of one step, `stand` the standing frame.
 */
export interface CharacterLayout {
  fw: number
  fh: number
  dir: 'rows' | 'cols'
  index: Record<Direction, number>
  stand: number
  cycle: number[]
  /** Top-left pixel of the character inside its sheet (sheets that hold many characters). */
  ox?: number
  oy?: number
  /** Sheets with a single pose: left is the mirrored right (no frames), and walking just bobs. */
  flipLeft?: boolean
  bob?: boolean
}

export interface CharacterDef {
  sheet: string
  layout: CharacterLayout
  /** Optional face portrait image (38x38 or so); otherwise the standing front frame is shown enlarged. */
  face?: string
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface ThemeManifest {
  id: ThemeId
  name: string
  description: string
  /** Pixel size of one map tile in this theme's art: the canvas is drawn at tileSize / 16 times the logical size. */
  tileSize: 16 | 32
  sheets: Record<string, SheetDef>
  tiles: ThemeTiles
  characters: Record<SpriteKey, CharacterDef>
  credits: CreditEntry[]
  /** Paints a placeholder tile instead of a missing one: the sheets listed here are optional (a failed load only warns). */
  optional?: boolean
}
