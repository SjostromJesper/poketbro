// Copies the graphics the themes use from `assets-raw/` (see `npm run fetch-assets`) into `public/assets/themes/<theme>/`.
// Which files a theme needs is given by its manifest in `nudge/game/themes/<theme>.ts`. Run with `npm run copy-graphics`.
// A missing source is reported and skipped (the theme then falls back to placeholders for it).
// Pipoya's files may not be redistributed: `public/assets/themes/pipoya/` is gitignored.
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'public', 'assets', 'themes')

type Sources = Record<string, string>

// --- Ninja Adventure (CC0)
const NINJA = 'assets-raw/ninja-adventure/Ninja Adventure - Asset Pack'
const NINJA_CHARACTERS = [
  'Boy', 'Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'OldMan', 'OldMan2', 'Woman', 'OldWoman', 'Hunter', 'Inspector',
  'Noble', 'Child', 'EggBoy', 'EggGirl', 'Princess', 'Knight', 'KnightGold', 'Samurai', 'SamuraiBlue', 'Monk', 'Master',
]
const ninja: Sources = {
  ...Object.fromEntries(NINJA_CHARACTERS.flatMap(id => [
    [`ninja/characters/${id}.png`, `${NINJA}/Actor/Character/${id}/SpriteSheet.png`],
    [`ninja/faces/${id}.png`, `${NINJA}/Actor/Character/${id}/Faceset.png`],
  ])),
  'ninja/tiles/floor.png': `${NINJA}/Backgrounds/Tilesets/TilesetFloor.png`,
  'ninja/tiles/nature.png': `${NINJA}/Backgrounds/Tilesets/TilesetNature.png`,
  'ninja/tiles/house.png': `${NINJA}/Backgrounds/Tilesets/TilesetHouse.png`,
  'ninja/tiles/water.png': `${NINJA}/Backgrounds/Tilesets/TilesetWater.png`,
  'ninja/tiles/interior-floor.png': `${NINJA}/Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png`,
  'ninja/tiles/ripples.png': `${NINJA}/Backgrounds/Animated/Water Ripples/SpriteSheet16x16.png`,
  'ninja/tiles/plant.png': `${NINJA}/Backgrounds/Animated/Plant/SpriteSheet16x16.png`,
}

// --- Tuxemon (mostly CC-BY-SA 4.0 / CC BY 3.0, attribution required)
const TUX = 'assets-raw/tuxemon/repo/mods/tuxemon'
const TUX_CHARACTERS = [
  'adventurer', 'cooldude', 'scientist', 'nurse', 'shopassistant', 'homemaker', 'maniac', 'postboy', 'girl1', 'childactor', 'heroine', 'miner', 'soldier',
  'fisher', 'riverboatcaptain', 'picnicker', 'professor', 'boss', 'disciple', 'knightlord', 'swimmer', 'dragonrider', 'florist',
]
const tuxemon: Sources = {
  ...Object.fromEntries(TUX_CHARACTERS.map(id => [`tuxemon/characters/${id}.png`, `${TUX}/sprites/${id}.png`])),
  'tuxemon/tiles/outdoor.png': `${TUX}/gfx/tilesets/outdoor.png`,
  'tuxemon/tiles/buch.png': `${TUX}/gfx/tilesets/Basic_Buch_Tiles_Compiled.png`,
  'tuxemon/tiles/vegetation.png': `${TUX}/gfx/tilesets/Vegetation_and_Outdoor_Fittings_by_George.png`,
  'tuxemon/tiles/kelvin.png': `${TUX}/gfx/tilesets/Outdoor_Tiles_-_City_and_Country_-_by_Kelvin_Shadewing.png`,
  'tuxemon/tiles/floors.png': `${TUX}/gfx/tilesets/Interior_Floors_by_George.png`,
  'tuxemon/ATTRIBUTIONS.md': 'assets-raw/tuxemon/ATTRIBUTIONS.md',
}

// --- Kenney Tiny Town + Tiny Dungeon (CC0)
const kenney: Sources = {
  'kenney/tiles/town.png': 'assets-raw/kenney-tiny-town/Tilemap/tilemap_packed.png',
  'kenney/tiles/dungeon.png': 'assets-raw/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
}

// --- Pipoya (32x32). NOT redistributable: public/assets/themes/pipoya/ is gitignored.
const PIPOYA = 'assets-raw/pipoya'
const PIPOYA_CHARACTERS: Record<string, string> = {
  player: 'Male/Male 01-1', rival: 'Male/Male 02-1', professor: 'Male/Male 05-1', nurse: 'Female/Female 03-1', clerk: 'Male/Male 07-1',
  mum: 'Female/Female 05-1', old: 'Male/Male 12-1', boy: 'Male/Male 03-1', girl: 'Female/Female 01-1', youngster: 'Male/Male 04-1',
  lass: 'Female/Female 02-1', bugcatcher: 'Male/Male 06-1', hiker: 'Male/Male 08-1', fisher: 'Male/Male 09-1', sailor: 'Male/Male 10-1',
  picnicker: 'Female/Female 04-1', scientist: 'Male/Male 11-1', karate: 'Male/Male 13-1', psychic: 'Female/Female 06-1', leader1: 'Boss/Boss 01',
  leader2: 'Male/Male 14-1', leader3: 'Female/Female 07-1', leader4: 'Female/Female 08-1',
}
const PIPOYA_TILES = `${PIPOYA}/tileset/Pipoya RPG Tileset 32x32`
const pipoya: Sources = {
  ...Object.fromEntries(Object.entries(PIPOYA_CHARACTERS).map(([key, file]) => [`pipoya/characters/${key}.png`, `${PIPOYA}/characters/PIPOYA FREE RPG Character Sprites 32x32/${file}.png`])),
  'pipoya/tiles/base.png': `${PIPOYA_TILES}/[Base]BaseChip_pipo.png`,
  'pipoya/tiles/water.png': `${PIPOYA_TILES}/[A]_type1/[A]Water1_pipo.png`,
  'pipoya/tiles/grass.png': `${PIPOYA_TILES}/[A]_type1/[A]Grass1_pipo.png`,
  'pipoya/tiles/longgrass.png': `${PIPOYA_TILES}/[A]_type1/[A]LongGrass_pipo.png`,
  'pipoya/tiles/dirt.png': `${PIPOYA_TILES}/[A]_type1/[A]Dirt1_pipo.png`,
  'pipoya/tiles/flower.png': `${PIPOYA_TILES}/[A]_type1/[A]Flower_pipo.png`,
}

const SOURCES: Sources = { ...ninja, ...tuxemon, ...kenney, ...pipoya }

async function main() {
  let copied = 0
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
    copied++
  }
  console.log(`Copied ${copied} files to ${OUT}`)
}

void main()
