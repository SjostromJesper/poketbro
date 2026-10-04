// Every sound the game can play: ids -> files under public/assets/nudge/audio (copied by `npm run copy-audio`) and a per-file gain.
// Sound effects come from Juhani Junkala's retro SFX pack and Ninja Adventure, jingles from Ninja Adventure (all CC0).
// Pokémon cries are not listed here: their URLs are in the species data (`SpeciesData.cry`).

export interface SoundDef {
  src: string
  /** Gain for this file (0-1), to even out loud and quiet files. */
  volume?: number
}

const sfx = (name: string, volume = 1): SoundDef => ({ src: `/assets/nudge/audio/sfx/${name}.wav`, volume })
const jingle = (name: string, volume = 1): SoundDef => ({ src: `/assets/nudge/audio/jingles/${name}.wav`, volume })

export const SFX = {
  menuMove: sfx('menu-move', 0.6),
  menuConfirm: sfx('menu-confirm', 0.7),
  menuCancel: sfx('menu-cancel', 0.7),
  bump: sfx('bump', 0.5),
  door: sfx('door', 0.8),
  warp: sfx('warp', 0.7),
  coin: sfx('coin', 0.7),
  buy: sfx('buy', 0.8),
  pickup: sfx('pickup', 0.8),
  itemUse: sfx('item-use', 0.8),
  evolve: sfx('evolve', 0.9),
  encounter: sfx('encounter', 0.8),
  hitNormal: sfx('hit-normal', 0.8),
  hitSuper: sfx('hit-super', 0.9),
  hitWeak: sfx('hit-weak', 0.55),
  hitCrit: sfx('hit-crit', 1),
  miss: sfx('miss', 0.6),
  noEffect: sfx('no-effect', 0.6),
  faint: sfx('faint', 0.8),
  statUp: sfx('stat-up', 0.6),
  statDown: sfx('stat-down', 0.6),
  status: sfx('status', 0.6),
  heal: sfx('heal', 0.8),
  nudgeClick: sfx('nudge-click', 0.7),
  nudgeFollowed: sfx('nudge-followed', 0.7),
  nudgeIgnored: sfx('nudge-ignored', 0.5),
  runAway: sfx('run-away', 0.7),
  ballThrow: sfx('ball-throw', 0.8),
  ballOpen: sfx('ball-open', 0.8),
  ballShake: sfx('ball-shake', 0.8),
  ballClick: sfx('ball-click', 0.9),
  ballBreak: sfx('ball-break', 0.8),
} as const satisfies Record<string, SoundDef>

export type SfxId = keyof typeof SFX

/** Short tunes that play over (and duck) the music. */
export const JINGLES = {
  levelUp: jingle('level-up', 0.8),
  victory: jingle('victory', 0.8),
  heal: jingle('heal', 0.8),
  catch: jingle('catch', 0.8),
  badge: jingle('badge', 0.9),
  item: jingle('item', 0.8),
  evolution: jingle('evolution', 0.8),
  favorite: jingle('favorite', 0.7),
  gameOver: jingle('game-over', 0.8),
} as const satisfies Record<string, SoundDef>

export type JingleId = keyof typeof JINGLES

const music = (name: string, volume = 1): SoundDef => ({ src: `/assets/nudge/audio/music/${name}.ogg`, volume })

/** Looping music tracks (Juhani Junkala's JRPG packs and Ninja Adventure, all CC0). */
export const MUSIC = {
  title: music('title', 0.9),
  hemstad: music('hemstad'),
  home: music('home'),
  grusstad: music('grusstad'),
  route1: music('route1'),
  skogen: music('skogen'),
  center: music('center'),
  gym: music('gym'),
  battleWild: music('battle-wild'),
  battleTrainer: music('battle-trainer'),
  battleGym: music('battle-gym'),
} as const satisfies Record<string, SoundDef>

export type MusicId = keyof typeof MUSIC
