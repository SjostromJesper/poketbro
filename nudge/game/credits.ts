// What the Credits screen lists (pure data, so a test can check that everything the game uses is credited).
export interface CreditEntry {
  title: string
  by: string
  what: string
  license: string
  url: string
}

export const CREDITS: CreditEntry[] = [
  {
    title: 'Ninja Adventure Asset Pack',
    by: 'pixel-boy och AAA',
    what: 'Kartgrafik (marker, träd, hus, vatten, golv), karaktärerna och deras ansiktsporträtt, några ljudeffekter, jinglar och en del av musiken.',
    license: 'CC0',
    url: 'https://pixel-boy.itch.io/ninja-adventure-asset-pack',
  },
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
