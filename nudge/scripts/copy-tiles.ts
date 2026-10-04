// Copies the tile sheets the overworld uses from `assets-raw/` (see `npm run fetch-assets`) into `public/assets/nudge/tiles/`.
// The sheets and sizes are listed in `nudge/game/tileset-manifest.ts`. Run with `npm run copy-tiles`.
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'public', 'assets', 'nudge', 'tiles')
const BACKGROUNDS = 'assets-raw/ninja-adventure/Ninja Adventure - Asset Pack/Backgrounds'

/** public file name -> source under the repository root. */
const TILE_SOURCES: Record<string, string> = {
  'floor.png': `${BACKGROUNDS}/Tilesets/TilesetFloor.png`,
  'nature.png': `${BACKGROUNDS}/Tilesets/TilesetNature.png`,
  'house.png': `${BACKGROUNDS}/Tilesets/TilesetHouse.png`,
  'water.png': `${BACKGROUNDS}/Tilesets/TilesetWater.png`,
  'interior-floor.png': `${BACKGROUNDS}/Tilesets/Interior/TilesetInteriorFloor.png`,
  'ripples.png': `${BACKGROUNDS}/Animated/Water Ripples/SpriteSheet16x16.png`,
  'plant.png': `${BACKGROUNDS}/Animated/Plant/SpriteSheet16x16.png`,
}

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const [name, source] of Object.entries(TILE_SOURCES)) {
    const from = join(ROOT, source)
    try {
      await stat(from)
    } catch {
      console.warn(`Missing source (skipped): ${source}`)
      continue
    }
    await copyFile(from, join(OUT, name))
  }
  console.log(`Copied tile sheets to ${OUT}`)
}

void main()
