// Character sprites (Ninja Adventure, CC0): which sheet an NPC, trainer or the player uses and which piece of it to draw. Pure TypeScript.
// Every sheet is 4 columns (facing: down, up, left, right) of 16x16 frames; the first rows are the walk cycle (4 frames, or 2
// for the small sheets) and the first frame is also the standing pose. Each character also has a 38x38 face portrait.
import type { Direction, NpcLook } from './types'

export interface CharacterInfo {
  /** Frames in the walk cycle (rows of the sheet used for walking). */
  frames: number
}

const FULL: CharacterInfo = { frames: 4 }
const SMALL: CharacterInfo = { frames: 2 }

/** Sprite ids are the pack's character folder names. */
export const CHARACTERS = {
  Boy: FULL, Villager: FULL, Villager2: FULL, Villager3: FULL, Villager4: FULL, Villager5: FULL, OldMan: FULL, OldMan2: FULL, Woman: FULL,
  OldWoman: SMALL, Hunter: FULL, Inspector: FULL, Noble: FULL, Child: SMALL, EggBoy: FULL, EggGirl: FULL, Princess: FULL, Knight: FULL,
  KnightGold: FULL, Samurai: FULL, SamuraiBlue: FULL, Monk: FULL, Master: FULL,
} as const satisfies Record<string, CharacterInfo>

export type SpriteId = keyof typeof CHARACTERS

export const sheetUrl = (id: SpriteId) => `/assets/nudge/characters/${id}.png`
export const faceUrl = (id: SpriteId) => `/assets/nudge/faces/${id}.png`

/** The player's sprite. */
export const PLAYER_SPRITE: SpriteId = 'Boy'

/** The sprite an NPC gets when its definition has no explicit `sprite`. */
export const LOOK_SPRITE: Record<Exclude<NpcLook, 'pc'>, SpriteId> = {
  boy: 'Villager',
  girl: 'Woman',
  old: 'OldMan',
  professor: 'Master',
  nurse: 'Princess',
  clerk: 'Noble',
  mum: 'Villager4',
  hiker: 'Hunter',
  bugcatcher: 'Child',
  leader: 'KnightGold',
}

/** The sprite to draw for a definition with a `look` and an optional explicit `sprite`; null for objects like the PC. */
export function spriteFor(def: { look: NpcLook, sprite?: SpriteId }): SpriteId | null {
  if (def.sprite) return def.sprite
  return def.look === 'pc' ? null : LOOK_SPRITE[def.look]
}

const COLUMN: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 }

/**
 * The 16x16 piece of the sheet for a facing and a walk progress (0..1 through one step, or -1 for standing).
 * Returns the column and row in tiles of the sheet.
 */
export function spriteFrame(id: SpriteId, facing: Direction, walk: number): { col: number, row: number } {
  const frames = CHARACTERS[id].frames
  const row = walk < 0 ? 0 : Math.min(frames - 1, Math.floor(walk * frames)) % frames
  return { col: COLUMN[facing], row }
}
