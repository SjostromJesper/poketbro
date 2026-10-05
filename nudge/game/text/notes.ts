// "Professorns anteckningar" (PLAN-4 1.4): short explanations of the rules, unlocked when the game first explains them. Edit the texts here.
export type NoteId = 'atb' | 'nudge' | 'nature' | 'trait' | 'trust' | 'favorite' | 'capture' | 'obedience'

export interface Note {
  id: NoteId
  title: string
  lines: string[]
}

export const NOTES: Note[] = [
  {
    id: 'atb', title: 'ATB-baren',
    lines: [
      'Varje Pokémon har en bar som fylls av sig själv. När den är full agerar Pokémonen.',
      'Snabba Pokémon fyller baren fortare och hinner agera oftare än långsamma. Du ger inga order: Pokémonen väljer själv vad den gör.',
    ],
  },
  {
    id: 'nudge', title: 'Uppmuntran (nudge)',
    lines: [
      'Klicka på en attack (eller tryck 1-4) för att uppmuntra Pokémonen att välja den vid nästa val. Det är ett rop, inte en order.',
      'Varje strid har bara några få nudges, och varje ny nudge väger lite mindre än den förra. Prickarna visar hur många som finns kvar.',
      'När Pokémonen följer ditt rop syns ♪. Väljer den något annat syns …',
    ],
  },
  {
    id: 'nature', title: 'Natur',
    lines: [
      'Naturen höjer en egenskap och sänker en annan, och påverkar vilka sorters attacker Pokémonen föredrar (anfall, försvar eller stöd).',
      'Du ser den i Pokémonens sammanfattning i menyn.',
    ],
  },
  {
    id: 'trait', title: 'Drag (personlighet)',
    lines: [
      'Draget är Pokémonens personlighet. En lojal Pokémon orkar lyssna fler gånger per strid, en envis bara en. Skygga Pokémon försvarar sig när de är skadade, hetsiga väljer den starkaste attacken.',
      'Draget ändras aldrig. Det slumpas när Pokémonen fångas eller föds.',
    ],
  },
  {
    id: 'trust', title: 'Förtroende (trust)',
    lines: [
      'Förtroendet visas som hjärtan. Ju mer en Pokémon litar på dig, desto starkare väger dina nudges och desto smartare väljer den själv.',
      'Det växer när ni vinner tillsammans, när den går upp i nivå och när du läker den på ett Pokémon Center. Det sjunker när den svimmar. Med lite förtroende kan den strunta i dig.',
    ],
  },
  {
    id: 'favorite', title: 'Favoritattack',
    lines: [
      'Använder en Pokémon samma attack gång på gång och vinner med den kan den få en favoritattack. Den väljer den oftare på egen hand, och blir ledsen om den glömmer den.',
    ],
  },
  {
    id: 'capture', title: 'Fångst',
    lines: [
      'Kasta en Poké Ball på en vild Pokémon. Ju svagare den är (lite HP kvar, eller en statusåkomma), desto lättare är den att fånga. Bättre bollar hjälper också.',
      'Tränarnas Pokémon går inte att fånga.',
    ],
  },
  {
    id: 'obedience', title: 'Lydnad och märken',
    lines: [
      'Pokémon över en viss nivå lyssnar inte alltid på dig: gränsen är nivå 15 plus 10 per gymmärke du har. Över gränsen kan de slappa, göra något annat eller ta en tupplur.',
      'Fler märken betyder att starkare Pokémon lyder dig.',
    ],
  },
]

export const NOTES_BY_ID: Record<NoteId, Note> = Object.fromEntries(NOTES.map(n => [n.id, n])) as Record<NoteId, Note>
