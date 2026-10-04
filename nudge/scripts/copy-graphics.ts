// Copies the graphics the game uses from `assets-raw/` (see `npm run fetch-assets`) into `public/assets/nudge/`:
// tile sheets (listed in `nudge/game/tileset-manifest.ts`) and character sprite sheets + face portraits
// (listed in `nudge/game/sprites.ts`). Run with `npm run copy-graphics`.
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'public', 'assets', 'nudge')
const PACK = 'assets-raw/ninja-adventure/Ninja Adventure - Asset Pack'
const BACKGROUNDS = `${PACK}/Backgrounds`
const CHARACTERS = `${PACK}/Actor/Character`

/** Characters whose sheets and faces are copied (see CHARACTERS in nudge/game/sprites.ts). */
const CHARACTER_IDS = [
  'Boy', 'Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'OldMan', 'OldMan2', 'Woman', 'OldWoman', 'Hunter', 'Inspector',
  'Noble', 'Child', 'EggBoy', 'EggGirl', 'Princess', 'Knight', 'KnightGold', 'Samurai', 'SamuraiBlue', 'Monk', 'Master',
]

/** public path (under public/assets/nudge) -> source under the repository root. */
const SOURCES: Record<string, string> = {
  ...Object.fromEntries(CHARACTER_IDS.flatMap(id => [
    [`characters/${id}.png`, `${CHARACTERS}/${id}/SpriteSheet.png`],
    [`faces/${id}.png`, `${CHARACTERS}/${id}/Faceset.png`],
  ])),
  'tiles/floor.png': `${BACKGROUNDS}/Tilesets/TilesetFloor.png`,
  'tiles/nature.png': `${BACKGROUNDS}/Tilesets/TilesetNature.png`,
  'tiles/house.png': `${BACKGROUNDS}/Tilesets/TilesetHouse.png`,
  'tiles/water.png': `${BACKGROUNDS}/Tilesets/TilesetWater.png`,
  'tiles/interior-floor.png': `${BACKGROUNDS}/Tilesets/Interior/TilesetInteriorFloor.png`,
  'tiles/ripples.png': `${BACKGROUNDS}/Animated/Water Ripples/SpriteSheet16x16.png`,
  'tiles/plant.png': `${BACKGROUNDS}/Animated/Plant/SpriteSheet16x16.png`,
}

async function main() {
  for (const [name, source] of Object.entries(SOURCES)) {
    const from = join(ROOT, source)
    try {
      await stat(from)
    } catch {
      console.warn(`Missing source (skipped): ${source}`)
      continue
    }
    await mkdir(dirname(join(OUT, name)), { recursive: true })
    await copyFile(from, join(OUT, name))
  }
  console.log(`Copied graphics to ${OUT}`)
}

void main()
