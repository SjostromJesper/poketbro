import type { MapDef } from '../types'

export const proflab: MapDef = {
  id: 'proflab',
  name: 'Professorns labb',
  indoor: true,
  tiles: [
    '##########',
    '#TTTTTTTT#',
    '#FFFFFFFF#',
    '#FFFFFFFF#',
    '#FFFTTFFF#',
    '#FFFFFFFF#',
    '#FFFFFFFF#',
    '####M#####',
  ],
  warps: [{ x: 4, y: 7, to: 'hemstad', toX: 15, toY: 5, facing: 'down' }],
  npcs: [
    {
      id: 'professor', x: 4, y: 2, facing: 'down', look: 'professor', action: 'starter', name: 'Professor Almqvist',
      dialog: [
        'Välkommen! Jag är professor Almqvist.',
        'Pokémon här slåss inte som du kanske är van vid. De väljer själva sina attacker, i realtid!',
        'Du kan ändå påverka dem: klicka på en av deras attacker under striden, så blir den mer sannolik att väljas. Det kallar jag att nudga.',
        'Men var försiktig! Varje strid har bara ett fåtal nudges, och varje ny nudge påverkar lite mindre än den förra.',
        'Ju mer en Pokémon litar på dig, desto bättre lyssnar den - och desto smartare väljer den.',
        'Nu är det dags: välj din första Pokémon!',
      ],
      dialogAfter: {
        flag: 'starter',
        lines: [
          'Ta väl hand om din Pokémon! Gå norrut genom Väg 1 och Viridianskogen, så kommer du till Grusstad.',
          'Där finns ett gym. Lycka till!',
        ],
      },
    },
    {
      id: 'assistent', x: 7, y: 3, facing: 'left', look: 'girl', name: 'Assistent',
      dialog: ['En Pokémons natur påverkar vilka sorters attacker den föredrar.', 'Titta på dess sammanfattning i menyn för att se natur och drag!'],
    },
  ],
  trainers: [],
  signs: [],
}
