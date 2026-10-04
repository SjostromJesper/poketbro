// Copies the sound files the game really uses from `assets-raw/` (see `npm run fetch-assets`) into `public/assets/nudge/audio/`.
// The ids and public paths are in `nudge/game/audio-manifest.ts`; this list says where each file comes from.
// Run with `npm run copy-audio`. A missing source is reported and skipped (the game plays without that sound).
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RAW = join(ROOT, 'assets-raw')
const OUT = join(ROOT, 'public', 'assets', 'nudge', 'audio')

// Juhani Junkala's "Essential Retro Video Game Sound Effects" (CC0), Ninja Adventure by pixel-boy (CC0) and Junkala's JRPG music packs (CC0).
const JUNKALA = 'sfx/The Essential Retro Video Game Sound Effects Collection [512 sounds] By Juhani Junkala'
const NINJA = 'ninja-adventure/Ninja Adventure - Asset Pack/Audio'
const j = (path: string) => `${JUNKALA}/${path}`
const n = (path: string) => `${NINJA}/${path}`
const m = (path: string) => `music/${path}`

/** public name (under public/assets/nudge/audio) -> source path under assets-raw. */
export const AUDIO_SOURCES: Record<string, string> = {
  // --- UI and overworld
  'sfx/menu-move.wav': j('General Sounds/Menu Sounds/sfx_menu_move1.wav'),
  'sfx/menu-confirm.wav': j('General Sounds/Menu Sounds/sfx_menu_select1.wav'),
  'sfx/menu-cancel.wav': n('Sounds/Menu/Cancel.wav'),
  'sfx/bump.wav': j('General Sounds/Impacts/sfx_sounds_impact4.wav'),
  'sfx/door.wav': j('Movement/Opening Doors/sfx_movement_dooropen1.wav'),
  'sfx/warp.wav': j('Movement/Portals and Transitions/sfx_movement_portal2.wav'),
  'sfx/coin.wav': j('General Sounds/Coins/sfx_coin_single1.wav'),
  'sfx/buy.wav': j('General Sounds/Coins/sfx_coin_double2.wav'),
  'sfx/pickup.wav': j('General Sounds/Interactions/sfx_sounds_interaction5.wav'),
  'sfx/item-use.wav': n('Sounds/Magic & Skill/Heal2.wav'),
  'sfx/evolve.wav': j('General Sounds/Positive Sounds/sfx_sounds_powerup15.wav'),
  // --- Battle
  'sfx/encounter.wav': n('Sounds/Alert/Alert2.wav'),
  'sfx/hit-normal.wav': j('General Sounds/Simple Damage Sounds/sfx_damage_hit3.wav'),
  'sfx/hit-super.wav': j('General Sounds/Impacts/sfx_sounds_impact7.wav'),
  'sfx/hit-weak.wav': j('General Sounds/Simple Damage Sounds/sfx_damage_hit1.wav'),
  'sfx/hit-crit.wav': j('General Sounds/Impacts/sfx_sounds_impact12.wav'),
  'sfx/miss.wav': n('Sounds/Whoosh & Slash/Whoosh.wav'),
  'sfx/no-effect.wav': j('General Sounds/Simple Bleeps/sfx_sounds_Blip5.wav'),
  'sfx/faint.wav': j('General Sounds/Weird Sounds/sfx_sound_shutdown1.wav'),
  'sfx/stat-up.wav': j('General Sounds/Positive Sounds/sfx_sounds_powerup3.wav'),
  'sfx/stat-down.wav': j('General Sounds/Negative Sounds/sfx_sounds_negative2.wav'),
  'sfx/status.wav': j('General Sounds/Weird Sounds/sfx_sound_mechanicalnoise3.wav'),
  'sfx/heal.wav': n('Sounds/Magic & Skill/Heal.wav'),
  'sfx/nudge-click.wav': j('General Sounds/Simple Bleeps/sfx_sounds_Blip3.wav'),
  'sfx/nudge-followed.wav': j('General Sounds/Interactions/sfx_sounds_interaction3.wav'),
  'sfx/nudge-ignored.wav': j('General Sounds/Negative Sounds/sfx_sounds_error3.wav'),
  'sfx/run-away.wav': n('Sounds/Whoosh & Slash/Whoosh2.wav'),
  'sfx/ball-throw.wav': n('Sounds/Whoosh & Slash/Launch.wav'),
  'sfx/ball-open.wav': j('General Sounds/Weird Sounds/sfx_sound_bling.wav'),
  'sfx/ball-shake.wav': j('General Sounds/Buttons/sfx_sounds_button5.wav'),
  'sfx/ball-click.wav': j('General Sounds/Interactions/sfx_sounds_interaction20.wav'),
  'sfx/ball-break.wav': j('General Sounds/Weird Sounds/sfx_sound_shutdown2.wav'),
  // --- Music loops (ogg, streamed). Chosen by mood: see DECISIONS.md.
  'music/title.ogg': n('Musics/1 - Adventure Begin.ogg'),
  'music/hemstad.ogg': m('jrpg2/Town1 - Home Town.ogg'),
  'music/home.ogg': m('jrpg4/Calm1 - A Place I Call Home.ogg'),
  'music/grusstad.ogg': m('jrpg2/Town2 - Where Time Stands Still.ogg'),
  'music/route1.ogg': m('jrpg1/Exploration1 - Grasslands.ogg'),
  'music/skogen.ogg': m('jrpg1/Exploration5 - Sneaking Around.ogg'),
  'music/center.ogg': m('jrpg4/Calm3 - Peaceful Days.ogg'),
  'music/gym.ogg': m('jrpg1/Exploration2 - Military Base.ogg'),
  'music/battle-wild.ogg': m('jrpg5/Action3 - Preparing For Battle.ogg'),
  'music/battle-trainer.ogg': n('Musics/17 - Fight.ogg'),
  'music/battle-gym.ogg': m('jrpg5/Action1 - Encounter With The Witches.ogg'),
  // --- Jingles (short, ducking the music while they play)
  'jingles/level-up.wav': n('Jingles/LevelUp1.wav'),
  'jingles/victory.wav': n('Jingles/Success1.wav'),
  'jingles/heal.wav': n('Jingles/Success3.wav'),
  'jingles/catch.wav': n('Jingles/Success2.wav'),
  'jingles/badge.wav': n('Jingles/Success4.wav'),
  'jingles/item.wav': n('Jingles/Secret1.wav'),
  'jingles/evolution.wav': n('Jingles/LevelUp3.wav'),
  'jingles/favorite.wav': n('Jingles/Secret3.wav'),
  'jingles/game-over.wav': n('Jingles/GameOver.wav'),
}

async function main() {
  let copied = 0
  const missing: string[] = []
  for (const [target, source] of Object.entries(AUDIO_SOURCES)) {
    const from = join(RAW, source)
    const to = join(OUT, target)
    try {
      await stat(from)
    } catch {
      missing.push(source)
      continue
    }
    await mkdir(dirname(to), { recursive: true })
    await copyFile(from, to)
    copied++
  }
  console.log(`Copied ${copied} audio files to ${OUT}`)
  if (missing.length) console.warn(`Missing sources (skipped):\n${missing.map(m => `  ${m}`).join('\n')}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main()
