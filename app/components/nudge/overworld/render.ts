// Placeholder graphics for the overworld, drawn with canvas primitives (the plan's MVP "no tileset" approach).
// To plug in a real tileset later, create a renderer with `createTilesetRenderer(image, mapping)` instead of
// `createPlaceholderRenderer()`: both implement TileRenderer.
import type { Direction, NpcLook } from '~~/nudge/game/types'

export const TILE = 16

export interface TileRenderer {
  /**
   * Draws tile character `char` of the map at map position (tx, ty) into `ctx` at pixel position (px, py).
   * `frame` animates water/grass; `indoor` makes the solid '#' tile an interior wall instead of a tree.
   */
  drawTile(ctx: CanvasRenderingContext2D, char: string, tx: number, ty: number, px: number, py: number, frame: number, indoor: boolean): void
}

// ---------------------------------------------------------------------------
// Placeholder tiles
// ---------------------------------------------------------------------------

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

type Painter = (g: CanvasRenderingContext2D, variant: number, frame: number, tx: number, ty: number) => void

function px(g: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = color
  g.fillRect(x, y, w, h)
}

function ground(g: CanvasRenderingContext2D, variant: number) {
  px(g, '#8fcf6a', 0, 0, 16, 16)
  const specks = [[3, 4], [11, 2], [7, 10], [13, 12], [2, 13], [9, 6]]
  for (let i = 0; i < 3; i++) {
    const [x, y] = specks[(variant + i * 2) % specks.length]
    px(g, '#7bbd58', x, y, 2, 1)
  }
}

const PAINTERS: Record<string, Painter> = {
  '.': (g, v) => ground(g, v),
  '=': (g, v) => {
    px(g, '#e0c890', 0, 0, 16, 16)
    px(g, '#cfb478', 0, 0, 16, 1)
    const stones = [[2, 3], [10, 5], [6, 11], [13, 13], [4, 8]]
    for (let i = 0; i < 3; i++) {
      const [x, y] = stones[(v + i) % stones.length]
      px(g, '#b89a60', x, y, 2, 1)
    }
  },
  ',': (g, v, frame) => {
    px(g, '#3f9a4a', 0, 0, 16, 16)
    const sway = frame % 2
    for (let i = 0; i < 6; i++) {
      const x = 1 + i * 3 + ((v + i) % 2)
      const y = 3 + ((i * 5 + v) % 8)
      px(g, '#2c7a38', x + sway, y, 1, 6)
      px(g, '#5fc060', x + sway + 1, y - 1, 1, 3)
    }
    px(g, '#2c7a38', 0, 15, 16, 1)
  },
  '#': (g, v) => {
    ground(g, v)
    px(g, '#5a3a20', 7, 11, 2, 5)
    px(g, '#1f6a2c', 2, 1, 12, 11)
    px(g, '#2a8a3a', 3, 2, 10, 9)
    px(g, '#1f6a2c', 1, 4, 14, 5)
    px(g, '#4aac58', 4, 3, 3, 2)
  },
  '~': (g, v, frame) => {
    px(g, '#4a8fe0', 0, 0, 16, 16)
    const offset = (frame * 2 + v) % 8
    px(g, '#8fc4ff', (2 + offset) % 14, 4, 4, 1)
    px(g, '#8fc4ff', (9 + offset) % 14, 10, 4, 1)
    px(g, '#3a78c4', 0, 15, 16, 1)
  },
  'o': (g, v) => {
    ground(g, v)
    const colors = ['#ff6a8a', '#ffd84a', '#ffffff']
    for (let i = 0; i < 3; i++) {
      px(g, colors[(v + i) % 3], 2 + i * 5, 3 + ((i * 7 + v) % 8), 2, 2)
      px(g, '#2c7a38', 2 + i * 5, 5 + ((i * 7 + v) % 8), 1, 2)
    }
  },
  'f': (g, v) => {
    ground(g, v)
    px(g, '#b88a50', 0, 6, 16, 2)
    px(g, '#b88a50', 0, 11, 16, 2)
    px(g, '#8a6030', 1, 4, 2, 11)
    px(g, '#8a6030', 13, 4, 2, 11)
    px(g, '#8a6030', 7, 4, 2, 11)
  },
  'R': (g) => {
    px(g, '#c8503c', 0, 0, 16, 16)
    for (let y = 0; y < 16; y += 4) px(g, '#9a3a2a', 0, y + 3, 16, 1)
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < 16; x += 8) px(g, '#e0705a', x, y, 3, 1)
  },
  'W': (g, _v, _f, tx) => {
    px(g, '#ecdcb8', 0, 0, 16, 16)
    px(g, '#c8b48c', 0, 15, 16, 1)
    if (tx % 2 === 0) {
      px(g, '#5a4a30', 3, 3, 10, 9)
      px(g, '#9fd4f4', 4, 4, 8, 7)
      px(g, '#5a4a30', 7, 4, 2, 7)
      px(g, '#5a4a30', 4, 7, 8, 1)
    }
  },
  'D': (g) => {
    px(g, '#ecdcb8', 0, 0, 16, 16)
    px(g, '#5a3a20', 3, 1, 10, 15)
    px(g, '#8a5a30', 4, 2, 8, 14)
    px(g, '#ffd84a', 10, 9, 2, 2)
  },
  'S': (g, v) => {
    ground(g, v)
    px(g, '#6a4a28', 7, 8, 2, 8)
    px(g, '#b88a50', 2, 2, 12, 8)
    px(g, '#8a6030', 2, 2, 12, 1)
    px(g, '#5a3a20', 4, 4, 8, 1)
    px(g, '#5a3a20', 4, 6, 6, 1)
  },
  'indoor-wall': (g, v) => {
    px(g, '#7a6a8a', 0, 0, 16, 16)
    px(g, '#8a7a9a', 0, 0, 16, 7)
    px(g, '#5a4a6a', 0, 7, 16, 1)
    px(g, '#4a3a5a', 0, 8, 16, 8)
    px(g, '#5a4a6a', 3 + (v % 2) * 6, 10, 4, 1)
  },
  'F': (g, _v, _f, tx, ty) => {
    const light = (tx + ty) % 2 === 0
    px(g, light ? '#f0e4cc' : '#e4d6b8', 0, 0, 16, 16)
  },
  'T': (g) => {
    px(g, '#e4d6b8', 0, 0, 16, 16)
    px(g, '#8a5a30', 0, 3, 16, 11)
    px(g, '#b0804a', 0, 3, 16, 3)
    px(g, '#5a3a20', 0, 14, 16, 2)
  },
  'M': (g) => {
    px(g, '#f0e4cc', 0, 0, 16, 16)
    px(g, '#c8403c', 1, 4, 14, 8)
    px(g, '#e8706a', 2, 5, 12, 6)
  },
}

export function createPlaceholderRenderer(): TileRenderer {
  const cache = new Map<string, HTMLCanvasElement>()
  function sprite(char: string, variant: number, frame: number, tx: number, ty: number): HTMLCanvasElement {
    const painter = PAINTERS[char] ?? PAINTERS['#']
    // Only a few tiles depend on position; everything else is cached per variant/frame.
    const positional = char === 'W' || char === 'F'
    const key = `${char}:${variant}:${frame}${positional ? `:${tx % 2}:${ty % 2}` : ''}`
    let canvas = cache.get(key)
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = TILE
      canvas.height = TILE
      painter(canvas.getContext('2d')!, variant, frame, tx, ty)
      cache.set(key, canvas)
    }
    return canvas
  }
  return {
    drawTile(ctx, char, tx, ty, x, y, frame, indoor) {
      const variant = hash(tx, ty) % 4
      const animated = char === '~' || char === ','
      const name = indoor && char === '#' ? 'indoor-wall' : char
      ctx.drawImage(sprite(name, variant, animated ? frame % 2 : 0, tx, ty), x, y)
    },
  }
}

export interface TilesetConfig {
  image: CanvasImageSource
  tileSize: number
  /** Tile character -> top-left pixel of its sprite in the image. */
  map: Record<string, { sx: number, sy: number }>
}

export function createTilesetRenderer(config: TilesetConfig): TileRenderer {
  const fallback = createPlaceholderRenderer()
  return {
    drawTile(ctx, char, tx, ty, x, y, frame, indoor) {
      const at = config.map[char]
      if (!at) return fallback.drawTile(ctx, char, tx, ty, x, y, frame, indoor)
      ctx.drawImage(config.image, at.sx, at.sy, config.tileSize, config.tileSize, x, y, TILE, TILE)
    },
  }
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

interface Look {
  shirt: string
  pants: string
  hair: string
  skin: string
  cap?: string
}

export const LOOKS: Record<NpcLook | 'player', Look> = {
  player: { shirt: '#3a6ad8', pants: '#2a3a6a', hair: '#5a3a20', skin: '#f4c9a0', cap: '#e04040' },
  boy: { shirt: '#e8a030', pants: '#4a5a8a', hair: '#3a2a1a', skin: '#f4c9a0' },
  girl: { shirt: '#e86a9a', pants: '#6a4a8a', hair: '#a0602a', skin: '#f4c9a0' },
  old: { shirt: '#8a8a8a', pants: '#5a5a5a', hair: '#e8e8e8', skin: '#e8b890' },
  professor: { shirt: '#f4f4f4', pants: '#6a5a4a', hair: '#8a8a8a', skin: '#f4c9a0' },
  nurse: { shirt: '#f4a0b8', pants: '#f4f4f4', hair: '#e86a9a', skin: '#f4c9a0', cap: '#f4f4f4' },
  clerk: { shirt: '#4a8ad8', pants: '#3a3a5a', hair: '#3a2a1a', skin: '#f4c9a0', cap: '#3a6ac8' },
  mum: { shirt: '#c06ad8', pants: '#5a4a6a', hair: '#7a4a2a', skin: '#f4c9a0' },
  hiker: { shirt: '#8a6a3a', pants: '#4a4a3a', hair: '#5a3a20', skin: '#e8b890', cap: '#6a8a3a' },
  bugcatcher: { shirt: '#6ab04a', pants: '#8a7a4a', hair: '#e0c050', skin: '#f4c9a0', cap: '#f0e060' },
  leader: { shirt: '#7a5a3a', pants: '#3a3a3a', hair: '#2a2a2a', skin: '#e0a878' },
}

/**
 * Draws a 16x16 character with its feet on the bottom of the tile. `walk` is 0..1 progress through a step (or -1 when standing)
 * and drives the leg animation.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, facing: Direction, x: number, y: number, walk: number): void {
  const bob = walk >= 0 && Math.sin(walk * Math.PI * 2) > 0 ? -1 : 0
  const legPhase = walk >= 0 ? (walk < 0.5 ? 0 : 1) : 0
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fillRect(x + 3, y + 14, 10, 2)
  // legs
  ctx.fillStyle = look.pants
  if (facing === 'left' || facing === 'right') {
    ctx.fillRect(x + 5 + legPhase, y + 11, 3, 4)
    ctx.fillRect(x + 8 - legPhase, y + 11, 3, 4)
  } else {
    ctx.fillRect(x + 4, y + 11 + (legPhase ? 1 : 0), 3, 4 - (legPhase ? 1 : 0))
    ctx.fillRect(x + 9, y + 11 + (legPhase ? 0 : 1), 3, 4 - (legPhase ? 0 : 1))
  }
  // body
  ctx.fillStyle = look.shirt
  ctx.fillRect(x + 4, y + 6 + bob, 8, 6)
  // head
  ctx.fillStyle = look.skin
  ctx.fillRect(x + 4, y + 1 + bob, 8, 6)
  // hair / cap and facing details
  ctx.fillStyle = look.cap ?? look.hair
  if (facing === 'up') {
    ctx.fillRect(x + 4, y + 1 + bob, 8, 5)
  } else {
    ctx.fillRect(x + 4, y + 1 + bob, 8, 2)
    ctx.fillStyle = look.hair
    if (facing === 'left') ctx.fillRect(x + 9, y + 3 + bob, 3, 3)
    if (facing === 'right') ctx.fillRect(x + 4, y + 3 + bob, 3, 3)
  }
  ctx.fillStyle = '#2a2018'
  if (facing === 'down') {
    ctx.fillRect(x + 5, y + 4 + bob, 2, 2)
    ctx.fillRect(x + 9, y + 4 + bob, 2, 2)
  } else if (facing === 'left') {
    ctx.fillRect(x + 5, y + 4 + bob, 2, 2)
  } else if (facing === 'right') {
    ctx.fillRect(x + 9, y + 4 + bob, 2, 2)
  }
}

/** The "!" shown above a trainer that has spotted the player. */
export function drawExclamation(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + 6, y - 11, 4, 9)
  ctx.fillStyle = '#e03030'
  ctx.fillRect(x + 7, y - 10, 2, 5)
  ctx.fillRect(x + 7, y - 4, 2, 2)
}
