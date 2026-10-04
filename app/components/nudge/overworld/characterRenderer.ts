// Draws character sprites (Ninja Adventure sheets, see nudge/game/sprites.ts). Sheets load in the background: until a sheet is
// there `drawSprite` returns false and the caller draws the placeholder character instead.
import { CHARACTERS, sheetUrl, spriteFrame, type SpriteId } from '~~/nudge/game/sprites'
import type { Direction } from '~~/nudge/game/types'
import { TILE } from './render'

const sheets = new Map<SpriteId, HTMLImageElement>()
let started = false

/** Starts loading all character sheets (once). Failed sheets are simply never drawn. */
export function preloadCharacters(): void {
  if (started || typeof Image === 'undefined') return
  started = true
  for (const id of Object.keys(CHARACTERS) as SpriteId[]) {
    const image = new Image()
    image.onload = () => sheets.set(id, image)
    image.onerror = () => console.warn(`[sprites] could not load ${id}`)
    image.src = sheetUrl(id)
  }
}

/** Draws a character with its feet on the bottom of the tile at (x, y). `walk` is 0..1 through a step, or -1 when standing. */
export function drawSprite(ctx: CanvasRenderingContext2D, id: SpriteId, facing: Direction, x: number, y: number, walk: number): boolean {
  const image = sheets.get(id)
  if (!image) return false
  const { col, row } = spriteFrame(id, facing, walk)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x + TILE / 2, y + TILE - 2, 5, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.drawImage(image, col * TILE, row * TILE, TILE, TILE, x, y - 1, TILE, TILE)
  return true
}
