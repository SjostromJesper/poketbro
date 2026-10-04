// Types for the overworld: maps, entities and the world state. Pure TypeScript.
import type { MusicId } from './audio-manifest'
import type { SpriteId } from './sprites'
import type { BuildingPlacement } from './tileset-manifest'

export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRECTIONS: Record<Direction, { dx: number, dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

export const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }

/** Flags the world can require on a warp (e.g. "you need a Pokémon first"). */
export type RequirementFlag = 'starter'

export interface WarpDef {
  x: number
  y: number
  to: string
  toX: number
  toY: number
  /** Direction the player faces after arriving (default: keeps the current one). */
  facing?: Direction
  requires?: RequirementFlag
  blockedDialog?: string[]
}

export type NpcLook = 'boy' | 'girl' | 'old' | 'professor' | 'nurse' | 'clerk' | 'mum' | 'hiker' | 'bugcatcher' | 'leader' | 'pc'

/** Something an NPC does when talked to, besides the dialog. */
export type NpcAction = 'heal' | 'shop' | 'starter' | 'pc'

export interface NpcDef {
  id: string
  x: number
  y: number
  facing: Direction
  look: NpcLook
  /** Explicit character sprite; defaults to the one that goes with `look` (see sprites.ts). */
  sprite?: SpriteId
  name?: string
  dialog: string[]
  action?: NpcAction
  /** Replacement dialog once the given flag is set. */
  dialogAfter?: { flag: string, lines: string[] }
}

export interface TrainerSpot {
  id: string
  x: number
  y: number
  facing: Direction
  /** How many tiles straight ahead the trainer can see. */
  sight: number
}

export interface SignDef {
  x: number
  y: number
  text: string[]
}

export interface MapDef {
  id: string
  name: string
  /** One string per row, one character per tile (see tiles.ts). */
  tiles: string[]
  warps: WarpDef[]
  npcs: NpcDef[]
  trainers: TrainerSpot[]
  signs: SignDef[]
  /** Key into the encounter tables (encounters.ts). */
  encounterTable?: string
  indoor?: boolean
  /** Indoor floor material: wood-coloured cobbles (default) or dark stone. */
  floor?: 'wood' | 'stone'
  /** Multi-tile buildings drawn from sprites. The ASCII tiles under them stay R/W/D so collision does not change. */
  buildings?: BuildingPlacement[]
  /** Music loop id (see audio-manifest.ts) that plays on this map. */
  music?: MusicId
}

export interface TrainerMon {
  speciesId: number
  level: number
  moves?: string[]
  heldItem?: string
}

export interface TrainerDef {
  id: string
  name: string
  /** Class shown in dialog, e.g. "Ung tränare". */
  title: string
  look: NpcLook
  /** Explicit character sprite; defaults to the one that goes with `look`. */
  sprite?: SpriteId
  team: TrainerMon[]
  intro: string[]
  defeated: string[]
  /** Set for gym leaders. */
  gym?: { badge: string, badgeName: string, tm: string, rewardDialog: string[] }
}

export interface WorldState {
  mapId: string
  x: number
  y: number
  facing: Direction
  /** Ids of defeated trainers: they do not challenge again. */
  defeatedTrainers: string[]
  /** Free-form story flags ('starter', 'badge-granit', ...). */
  flags: string[]
  /** Where "blackout" sends the player (the last Pokémon Center they used). */
  lastCenter: { mapId: string, x: number, y: number }
  steps: number
}
