// Which piece of a character sheet to draw for a facing and a walk progress (pure).
import type { Direction } from '../types'
import type { CharacterLayout } from './types'

export interface FrameRect {
  /** Source rectangle in the sheet, in pixels. */
  sx: number
  sy: number
  sw: number
  sh: number
  /** Mirror horizontally (sheets with only one side pose). */
  flip: boolean
  /** Raise the sprite one pixel (walking bounce of single-pose sheets). */
  bob: boolean
}

/**
 * `walk` is the progress through one step (0..1), or -1 when standing.
 * Standing uses `stand`; a step goes through `cycle`.
 */
export function frameFor(layout: CharacterLayout, facing: Direction, walk: number): FrameRect {
  const frames = layout.cycle.length
  const frame = walk < 0 ? layout.stand : layout.cycle[Math.min(frames - 1, Math.floor(walk * frames))]
  const mirrored = !!layout.flipLeft && facing === 'left'
  const dir = layout.index[mirrored ? 'right' : facing]
  const col = layout.dir === 'rows' ? frame : dir
  const row = layout.dir === 'rows' ? dir : frame
  const bobbing = !!layout.bob && walk >= 0 && Math.floor(walk * 2) % 2 === 0
  return { sx: (layout.ox ?? 0) + col * layout.fw, sy: (layout.oy ?? 0) + row * layout.fh, sw: layout.fw, sh: layout.fh, flip: mirrored, bob: bobbing }
}

/** The face portrait fallback: the standing frame looking down. */
export function portraitFrame(layout: CharacterLayout): FrameRect {
  return frameFor(layout, 'down', -1)
}
