// Loads a graphics theme (its sheet images) and draws with it: map tiles, characters and face portraits.
// Anything the theme does not have falls back to the neutral placeholder drawing, with one console warning per item.
import { frameFor, portraitFrame } from '~~/nudge/game/themes/characters'
import { describeTile } from '~~/nudge/game/themes/engine'
import { getTheme } from '~~/nudge/game/themes'
import type { Layer, ThemeId, ThemeManifest, SpriteKey } from '~~/nudge/game/themes/types'
import type { Direction, MapDef } from '~~/nudge/game/types'
import { createPlaceholderRenderer, TILE, type TileRenderer } from './render'

const warned = new Set<string>()
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[theme] ${message}`)
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      warnOnce(src, `could not load ${src}`)
      resolve(null)
    }
    image.src = src
  })
}

// Small signs painted over building sprites (Pokémon Center, Mart, gym) and the door mat.
const GLYPHS: Record<string, string[]> = {
  G: ['XXX', 'X..', 'X.X', 'X.X', 'XXX'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  M: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
}

function drawGlyph(ctx: CanvasRenderingContext2D, letter: string, x: number, y: number, color: string) {
  ctx.fillStyle = color
  GLYPHS[letter].forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === 'X') ctx.fillRect(x + i, y + j, 1, 1)
  })
}

function drawBadge(ctx: CanvasRenderingContext2D, badge: 'cross' | 'bag' | 'dojo' | 'mat', x: number, y: number) {
  if (badge === 'mat') {
    ctx.fillStyle = '#7a2a2a'
    ctx.fillRect(x + 1, y + 4, 14, 9)
    ctx.fillStyle = '#c8403c'
    ctx.fillRect(x + 2, y + 5, 12, 7)
    ctx.fillStyle = '#e8706a'
    ctx.fillRect(x + 3, y + 6, 10, 1)
  } else if (badge === 'cross') {
    ctx.fillStyle = '#3a2a2a'
    ctx.fillRect(x + 3, y + 3, 10, 10)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 4, y + 4, 8, 8)
    ctx.fillStyle = '#e03a4a'
    ctx.fillRect(x + 7, y + 5, 2, 6)
    ctx.fillRect(x + 5, y + 7, 6, 2)
  } else if (badge === 'bag') {
    ctx.fillStyle = '#1a2a4a'
    ctx.fillRect(x + 3, y + 3, 10, 10)
    ctx.fillStyle = '#3a7ad8'
    ctx.fillRect(x + 4, y + 4, 8, 8)
    drawGlyph(ctx, 'M', x + 6, y + 6, '#ffffff')
  } else {
    ctx.fillStyle = '#4a1a1a'
    ctx.fillRect(x, y + 4, 16, 9)
    ctx.fillStyle = '#c8402c'
    ctx.fillRect(x + 1, y + 5, 14, 7)
    drawGlyph(ctx, 'G', x + 3, y + 6, '#ffffff')
    drawGlyph(ctx, 'Y', x + 7, y + 6, '#ffffff')
    drawGlyph(ctx, 'M', x + 11, y + 6, '#ffffff')
  }
}

/** One tile of a painted house (5 x 4 tiles: two roof rows, a window row and a door row). */
function drawHouse(ctx: CanvasRenderingContext2D, h: { roof: string, wall: string, trim: string, dx: number, dy: number }, x: number, y: number) {
  const dark = 'rgba(0, 0, 0, 0.25)'
  if (h.dy < 2) {
    ctx.fillStyle = h.roof
    ctx.fillRect(x, y, TILE, TILE)
    ctx.fillStyle = dark
    for (let row = 3; row < TILE; row += 4) ctx.fillRect(x, y + row, TILE, 1)
    if (h.dy === 1) {
      ctx.fillStyle = h.trim
      ctx.fillRect(x, y + TILE - 3, TILE, 3)
    }
    return
  }
  ctx.fillStyle = h.wall
  ctx.fillRect(x, y, TILE, TILE)
  ctx.fillStyle = dark
  ctx.fillRect(x, y + TILE - 1, TILE, 1)
  if (h.dy === 2 && (h.dx === 1 || h.dx === 3)) {
    ctx.fillStyle = h.trim
    ctx.fillRect(x + 3, y + 3, 10, 10)
    ctx.fillStyle = '#9fd4f4'
    ctx.fillRect(x + 4, y + 4, 8, 8)
    ctx.fillStyle = h.trim
    ctx.fillRect(x + 7, y + 4, 2, 8)
  }
  if (h.dy === 3 && h.dx === 2) {
    ctx.fillStyle = h.trim
    ctx.fillRect(x + 2, y + 1, 12, 15)
    ctx.fillStyle = '#6a4a2a'
    ctx.fillRect(x + 3, y + 2, 10, 14)
    ctx.fillStyle = '#ffd84a'
    ctx.fillRect(x + 10, y + 9, 2, 2)
  }
}

export interface Portrait {
  image: HTMLImageElement
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface LoadedTheme {
  manifest: ThemeManifest
  /** Canvas pixels per logical pixel (1 for 16x16 art, 2 for 32x32 art). */
  scale: number
  tiles: TileRenderer
  /** Draws a character with its feet on the bottom of the tile at (x, y); false when the theme has no sheet for it. */
  drawCharacter: (ctx: CanvasRenderingContext2D, key: SpriteKey, facing: Direction, x: number, y: number, walk: number) => boolean
  portrait: (key: SpriteKey) => Portrait | null
}

const cache = new Map<ThemeId, Promise<LoadedTheme>>()

/** Loads a theme once (all its sheets, character sheets and faces). Missing files only produce warnings. */
export function loadTheme(id: ThemeId): Promise<LoadedTheme> {
  let promise = cache.get(id)
  if (!promise) {
    promise = build(getTheme(id))
    cache.set(id, promise)
  }
  return promise
}

async function build(manifest: ThemeManifest): Promise<LoadedTheme> {
  const sheetIds = Object.keys(manifest.sheets)
  const sheetImages = await Promise.all(sheetIds.map(id => loadImage(manifest.sheets[id].src)))
  const sheets = new Map(sheetIds.map((id, i) => [id, sheetImages[i]]))

  const characterUrls = new Set<string>()
  for (const def of Object.values(manifest.characters)) {
    characterUrls.add(def.sheet)
    if (def.face) characterUrls.add(def.face)
  }
  const urls = [...characterUrls]
  const urlImages = await Promise.all(urls.map(loadImage))
  const images = new Map(urls.map((url, i) => [url, urlImages[i]]))

  const fallback = createPlaceholderRenderer()
  const scale = manifest.tileSize / 16

  function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, x: number, y: number): boolean {
    if ('badge' in layer) {
      drawBadge(ctx, layer.badge, x, y)
      return true
    }
    if ('solid' in layer) {
      ctx.fillStyle = layer.solid
      ctx.fillRect(x, y, TILE, TILE)
      return true
    }
    if ('house' in layer) {
      drawHouse(ctx, layer.house, x, y)
      return true
    }
    if ('edges' in layer) {
      const e = layer.edges
      ctx.fillStyle = layer.edges.color
      if (e.up) ctx.fillRect(x, y, TILE, 2)
      if (e.down) ctx.fillRect(x, y + TILE - 2, TILE, 2)
      if (e.left) ctx.fillRect(x, y, 2, TILE)
      if (e.right) ctx.fillRect(x + TILE - 2, y, 2, TILE)
      return true
    }
    const def = manifest.sheets[layer.sheet]
    const image = sheets.get(layer.sheet)
    if (!def || !image) return false
    const w = layer.w ?? 1
    const h = layer.h ?? 1
    ctx.drawImage(image, layer.tx * def.tileSize, layer.ty * def.tileSize, w * def.tileSize, h * def.tileSize, x, y, w * TILE, h * TILE)
    return true
  }

  const tiles: TileRenderer = {
    drawTile(ctx, map: MapDef, tx, ty, x, y, frame) {
      const layers = describeTile(manifest, map, tx, ty, { frame })
      if (!layers.length) return fallback.drawTile(ctx, map, tx, ty, x, y, frame)
      // All sheets must be there, otherwise the whole tile is drawn by the placeholder (no half tiles).
      for (const layer of layers) {
        if ('sheet' in layer && !sheets.get(layer.sheet)) {
          warnOnce(`${manifest.id}:${layer.sheet}`, `theme ${manifest.id} is missing sheet "${layer.sheet}", drawing placeholders`)
          return fallback.drawTile(ctx, map, tx, ty, x, y, frame)
        }
      }
      for (const layer of layers) drawLayer(ctx, layer, x, y)
    },
  }

  function drawCharacter(ctx: CanvasRenderingContext2D, key: SpriteKey, facing: Direction, x: number, y: number, walk: number): boolean {
    const def = manifest.characters[key]
    const image = def ? images.get(def.sheet) : null
    if (!def || !image) {
      warnOnce(`${manifest.id}:char:${key}`, `theme ${manifest.id} has no sheet for the character look "${key}"`)
      return false
    }
    const f = frameFor(def.layout, facing, walk)
    const dw = (f.sw * TILE) / manifest.tileSize
    const dh = (f.sh * TILE) / manifest.tileSize
    const dx = x + (TILE - dw) / 2
    const dy = y + TILE - dh - (f.bob ? 1 : 0)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.beginPath()
    ctx.ellipse(x + TILE / 2, y + TILE - 2, 5, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    if (f.flip) {
      ctx.save()
      ctx.translate(dx + dw, dy)
      ctx.scale(-1, 1)
      ctx.drawImage(image, f.sx, f.sy, f.sw, f.sh, 0, 0, dw, dh)
      ctx.restore()
    } else {
      ctx.drawImage(image, f.sx, f.sy, f.sw, f.sh, dx, dy, dw, dh)
    }
    return true
  }

  function portrait(key: SpriteKey): Portrait | null {
    const def = manifest.characters[key]
    if (!def) return null
    const face = def.face ? images.get(def.face) : null
    if (face) return { image: face, sx: 0, sy: 0, sw: face.width, sh: face.height }
    const sheet = images.get(def.sheet)
    if (!sheet) return null
    const f = portraitFrame(def.layout)
    // Without a face picture: the head and shoulders of the standing front frame.
    const size = Math.min(f.sw, f.sh)
    return { image: sheet, sx: f.sx, sy: f.sy, sw: f.sw, sh: size }
  }

  return { manifest, scale, tiles, drawCharacter, portrait }
}
