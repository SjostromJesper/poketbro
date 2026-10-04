// Draws the overworld tiles from the Ninja Adventure sheets, following `describeTile` (nudge/game/tileset-manifest.ts).
// Falls back to the placeholder tiles for anything the manifest does not cover, and gives up (returns null) if a sheet cannot be loaded.
import { describeTile, SHEETS, type SheetId, type TileLayer } from '~~/nudge/game/tileset-manifest'
import { createPlaceholderRenderer, TILE, type TileRenderer } from './render'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

// 3x5 pixel letters for the little signs on Pokémon buildings.
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

/** Small signs drawn on the roof row above the door: a red cross (Pokémon Center), an M (Pokémart) and GYM; plus the door mat. */
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
    ctx.fillRect(x + 0, y + 4, 16, 9)
    ctx.fillStyle = '#c8402c'
    ctx.fillRect(x + 1, y + 5, 14, 7)
    drawGlyph(ctx, 'G', x + 3, y + 6, '#ffffff')
    drawGlyph(ctx, 'Y', x + 7, y + 6, '#ffffff')
    drawGlyph(ctx, 'M', x + 11, y + 6, '#ffffff')
  }
}

/** Loads all tile sheets. Resolves to null when something is missing, so the caller keeps the placeholder graphics. */
export async function createNinjaRenderer(): Promise<TileRenderer | null> {
  let images: Record<SheetId, HTMLImageElement>
  try {
    const ids = Object.keys(SHEETS) as SheetId[]
    const loaded = await Promise.all(ids.map(id => loadImage(SHEETS[id].src)))
    images = Object.fromEntries(ids.map((id, i) => [id, loaded[i]])) as Record<SheetId, HTMLImageElement>
  } catch (error) {
    console.warn('[tiles] using placeholder graphics:', error)
    return null
  }
  const fallback = createPlaceholderRenderer()

  function drawLayer(ctx: CanvasRenderingContext2D, layer: TileLayer, x: number, y: number) {
    if ('badge' in layer) return drawBadge(ctx, layer.badge, x, y)
    ctx.drawImage(images[layer.sheet], layer.tx * TILE, layer.ty * TILE, TILE, TILE, x, y, TILE, TILE)
  }

  return {
    drawTile(ctx, map, tx, ty, x, y, frame) {
      const layers = describeTile(map, tx, ty, { frame })
      if (!layers.length) return fallback.drawTile(ctx, map, tx, ty, x, y, frame)
      for (const layer of layers) drawLayer(ctx, layer, x, y)
    },
  }
}
