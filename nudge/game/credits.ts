// What the Credits screen lists (pure data, so a test can check that everything the game uses is credited).
// The graphics packs come from the themes (each theme lists its own credits).
import { THEMES } from './themes'
import type { CreditEntry } from './themes/types'

export type { CreditEntry }

/** Packs used by the game apart from the themes: music, sound effects and Pokémon data. */
export const BASE_CREDITS: CreditEntry[] = [
  {
    title: 'JRPG Pack 1, 2, 4 och 5 (Exploration, Towns, Calm, Action)',
    by: 'Juhani Junkala',
    what: 'Musiken på kartorna och i striderna.',
    license: 'CC0',
    url: 'https://juhanijunkala.com/',
  },
  {
    title: 'The Essential Retro Video Game Sound Effects Collection',
    by: 'Juhani Junkala',
    what: 'Ljudeffekter för menyer, strider, fångst och värld.',
    license: 'CC0',
    url: 'https://juhanijunkala.com/',
  },
  {
    title: 'PokéAPI',
    by: 'PokéAPI-projektet',
    what: 'Pokémon-data, sprites och skrik (hämtas från pokeapi.co och deras GitHub-arkiv).',
    license: 'Pokémon och dess namn tillhör Nintendo, Game Freak och The Pokémon Company. Det här är en privat fanprototyp.',
    url: 'https://pokeapi.co',
  },
]

/** Every pack: the themes' graphics first, then the audio and data. All themes are listed, also the ones not in use right now. */
export const CREDITS: CreditEntry[] = [...Object.values(THEMES).flatMap(theme => theme.credits), ...BASE_CREDITS]
