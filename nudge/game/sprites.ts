// Which character look an NPC, trainer or the player has. The looks are theme independent (SpriteKey); each theme maps them to
// its own sheets (see themes/). Pure TypeScript.
import type { NpcLook } from './types'
import { SPRITE_KEYS, type SpriteKey } from './themes/types'

export { SPRITE_KEYS }
export type { SpriteKey }

/** The player's look. */
export const PLAYER_SPRITE: SpriteKey = 'player'

/** The look an NPC gets when its definition has no explicit `sprite`. */
export const LOOK_SPRITE: Record<Exclude<NpcLook, 'pc'>, SpriteKey> = {
  boy: 'boy',
  girl: 'girl',
  old: 'old',
  professor: 'professor',
  nurse: 'nurse',
  clerk: 'clerk',
  mum: 'mum',
  hiker: 'hiker',
  bugcatcher: 'bugcatcher',
  leader: 'leader1',
}

/** The look to draw for a definition with a `look` and an optional explicit `sprite`; null for objects like the PC. */
export function spriteFor(def: { look: NpcLook, sprite?: SpriteKey }): SpriteKey | null {
  if (def.sprite) return def.sprite
  return def.look === 'pc' ? null : LOOK_SPRITE[def.look]
}
