// Trainer definitions: who they are, what they say and what they bring. Placement (and sight) is in the map files.
import type { TrainerDef } from './types'

// Species ids (PokeAPI): 1 Bulbasaur, 4 Charmander, 7 Squirtle, 10 Caterpie, 11 Metapod, 13 Weedle, 14 Kakuna, 16 Pidgey,
// 19 Rattata, 21 Spearow, 27 Sandshrew, 50 Diglett, 74 Geodude, 95 Onix.

export const TRAINERS: Record<string, TrainerDef> = {
  'r1-kalle': {
    id: 'r1-kalle',
    name: 'Kalle',
    title: 'Ung tränare',
    look: 'boy',
    team: [{ speciesId: 19, level: 3 }, { speciesId: 16, level: 3 }],
    intro: ['Hallå där! Du har ju en Pokémon! Då slåss vi!'],
    defeated: ['Aj aj aj! Du var starkare än jag trodde.', 'Fortsätt norrut, det finns mer att se i skogen.'],
  },
  'r1-lisa': {
    id: 'r1-lisa',
    name: 'Lisa',
    title: 'Ung tränare',
    look: 'girl',
    team: [{ speciesId: 16, level: 4 }],
    intro: ['Mina Pokémon är tränade i det högsta gräset! Kom igen!'],
    defeated: ['Hm. Jag får träna mer i gräset.'],
  },
  'skog-olle': {
    id: 'skog-olle',
    name: 'Olle',
    title: 'Insektsfångare',
    look: 'bugcatcher',
    team: [{ speciesId: 13, level: 5 }, { speciesId: 10, level: 5 }],
    intro: ['Skogen är full av insekter! Vill du se mina?'],
    defeated: ['Mina insekter! De var så fina...'],
  },
  'skog-maja': {
    id: 'skog-maja',
    name: 'Maja',
    title: 'Insektsfångare',
    look: 'girl',
    team: [{ speciesId: 11, level: 6 }, { speciesId: 14, level: 6 }, { speciesId: 10, level: 6 }],
    intro: ['Du ska inte tro att insekter är svaga. Kokonger är sega!'],
    defeated: ['Du lyckades bryta igenom skalet...'],
  },
  'skog-elis': {
    id: 'skog-elis',
    name: 'Elis',
    title: 'Insektsfångare',
    look: 'bugcatcher',
    team: [{ speciesId: 13, level: 7 }, { speciesId: 14, level: 7 }],
    intro: ['Stopp! Ingen passerar Elis utan strid!'],
    defeated: ['Okej okej, du får gå. Grusstad ligger rakt norrut.'],
  },
  'gym-tor': {
    id: 'gym-tor',
    name: 'Tor',
    title: 'Gymelev',
    look: 'boy',
    team: [{ speciesId: 74, level: 8 }, { speciesId: 50, level: 8 }],
    intro: ['Det här är Granits gym! För att nå honom måste du först slå mig!'],
    defeated: ['Du är stark! Men Granit är hårdare än sten.'],
  },
  'gym-sofia': {
    id: 'gym-sofia',
    name: 'Sofia',
    title: 'Gymelev',
    look: 'girl',
    team: [{ speciesId: 27, level: 9 }],
    intro: ['Sten och mark, det är vår stil. Redo?'],
    defeated: ['Du krossade mig som en lerklump...'],
  },
  'gym-granit': {
    id: 'gym-granit',
    name: 'Granit',
    title: 'Gymledare',
    look: 'leader',
    team: [{ speciesId: 74, level: 10 }, { speciesId: 95, level: 12 }],
    intro: [
      'Jag är Granit, Grusstads gymledare!',
      'Min försvarsstrategi är lika hård som sten. Kan dina Pokémon knäcka den?',
    ],
    defeated: ['Hm! Jag erkänner mig besegrad.'],
    gym: {
      badge: 'granit',
      badgeName: 'Granitmärket',
      tm: 'rock-tomb',
      rewardDialog: [
        'Här, ta Granitmärket! Det bevisar att du besegrat Grusstads gym.',
        'Och ta den här TM:en också. Den innehåller Rock Tomb!',
      ],
    },
  },
}
