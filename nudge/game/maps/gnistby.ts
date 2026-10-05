import { mapBuilder } from '../mapBuilder'
import { gymLeader, trainer } from '../trainerClasses'
import { enterable, fillCenter, fillMart, road } from './layout'

// Sparkby: the town the power plant feeds, with an electric gym, a dojo that hands out a fighting Pokémon and guards on the road north that
// need three badges. Roads: Route 4 in the west, Route 5 in the north.
const m = mapBuilder('gnistby', 36, 26, { name: 'Gnistby', music: 'grusstad' })
m.border('tree', 2)
m.scatter(2, 2, 32, 22, 'tree', 8)
m.scatter(2, 2, 32, 22, 'flowers', 24)

road(m, 'w', 14, 'route4', 18)
road(m, 'n', 16, 'route5', 14, {
  requiresBadges: 3,
  blockedDialog: ['Vakten står i vägen. "Bergsvägen är för farlig för tränare med färre än tre märken!"'],
})
m.path([[2, 14], [33, 14]], { width: 2 })
m.path([[16, 14], [16, 1]], { width: 2 })
m.path([[6, 9], [6, 14]], { width: 1 })
m.path([[12, 9], [12, 14]], { width: 1 })
m.path([[22, 8], [22, 14]], { width: 1 })
m.path([[29, 9], [29, 14]], { width: 1 })
m.path([[14, 21], [8, 21], [8, 16]], { width: 1 })
m.blob(28, 20, 4, 2, 'water')
m.fill(4, 17, 6, 1, 'fence')

const center = enterable(m, 'center', 4, 5, 'gnistby_center', { name: 'Pokémon Center', music: 'center' })
const dojo = enterable(m, 'houseD', 10, 5, 'gnistby_hus1', { name: 'Karatedojon', music: 'home' })
const gym = enterable(m, 'gym', 20, 4, 'gnistby_gym', { name: 'Gnistbys gym', music: 'gym', floor: 'stone' })
const mart = enterable(m, 'mart', 27, 5, 'gnistby_mart', { name: 'Pokémart', music: 'center' })
const hus = enterable(m, 'houseB', 12, 17, 'gnistby_hus2', { name: 'Hus', music: 'home' })
m.scenery('houseC', 24, 17)
m.sign(14, 13, ['GNISTBY', 'Staden med strömmen. Gym: Ledare Ture (elektrisk).'])
m.sign(18, 3, ['VÄG 5', 'Norrut: bergsvägen. Du behöver tre märken för att få gå dit.'])
m.npc({
  id: 'gnistby-pojke', x: 20, y: 11, facing: 'right', look: 'boy',
  dialog: ['Ture är gymledare här. Hans Pokémon är laddade!', 'Mark-Pokémon är immuna mot elektricitet. Då är de bra att ha med!'],
})
m.npc({
  id: 'gnistby-gumma', x: 25, y: 12, facing: 'left', look: 'old',
  dialog: ['Förr i tiden hade vi ljus av stearin. Nu har vi Voltorb!', 'Fast de exploderar ibland.'],
})
for (const x of [16, 17]) {
  m.npc({
    id: `gnistby-vakt-${x}`, x, y: 3, facing: 'up', look: 'old', name: 'Vakt', gate: { badges: 3 },
    dialog: ['Bergsvägen är stängd för tränare med färre än tre märken.', 'Slå Ture, gymledaren här, och kom tillbaka!'],
  })
}
m.pickup({ id: 'gnistby-ball', x: 31, y: 22, item: 'great-ball', hidden: true })
m.pickup({ id: 'gnistby-potion', x: 6, y: 22, item: 'super-potion' })
m.trainer(trainer('gnistby-elis', 'Elis', 'youngster', { x: 26, y: 15, facing: 'auto' }, [[81, 18], [25, 19]]))

fillCenter(center, 'gnistby', 'Gnistby')
fillMart(mart, 'gnistby', 'Välkommen till Gnistbys Pokémart! Vi har TM:er som laddar.')

dojo
  .fill(1, 1, 2, 1, 'bed')
  .npc({
    id: 'gnistby-sensei', x: 4, y: 3, facing: 'down', look: 'hiker', sprite: 'karate', name: 'Sensei', action: 'give',
    dialog: [
      'Jag är dojons mästare. Två av mina elever tränar bara på att slå, och jag vill ha dem i goda händer.',
      'Hitmonlee sparkar, Hitmonchan slår. Du får välja en!',
    ],
    dialogAfter: { flag: 'hitmon', lines: ['Stridens väg är lång. Träna hårt, och var snäll mot din Pokémon.'] },
    give: { flag: 'hitmon', pokemon: [{ speciesId: 106, level: 20 }, { speciesId: 107, level: 20 }] },
  })

hus
  .fill(1, 1, 3, 1, 'shelf')
  .npc({
    id: 'gnistby-forskare', x: 3, y: 3, facing: 'down', look: 'professor', name: 'Forskare',
    dialog: ['Jag studerar Pokémon som växer när de byter ägare. Kadabra, Machoke, Graveler, Haunter...', 'Det är nästan som magi: de utvecklas på nivå 38, när de har sett tillräckligt mycket.'],
  })

gym.fill(2, 5, 2, 1, 'counter').fill(9, 5, 2, 1, 'counter').fill(2, 9, 2, 1, 'counter').fill(9, 9, 2, 1, 'counter')
gym.trainer(trainer('gnistby-gym-1', 'Ida', 'gymstudent', { x: 9, y: 7, facing: 'left', sight: 5 }, [[81, 17], [100, 18]], {
  sprite: 'scientist', intro: ['Du känner knitret? Det är Tures gym!'], defeated: ['Jag fick en stöt... av dig!'],
}))
gym.trainer(trainer('gnistby-gym-2', 'Joel', 'gymstudent', { x: 2, y: 11, facing: 'right', sight: 6 }, [[100, 18], [81, 19], [25, 19]], {
  intro: ['Ture tar inte emot vem som helst. Bevisa dig!'], defeated: ['Kortslutning...'],
}))
gym.trainer(trainer('gnistby-gym-3', 'Mia', 'gymstudent', { x: 10, y: 11, facing: 'left', sight: 4 }, [[82, 20], [25, 20]], {
  sprite: 'lass', intro: ['Elektricitet går alltid vägen med minst motstånd. Jag tänker inte ge dig något!'], defeated: ['Strömmen bröts.'],
}))
gym.trainer(gymLeader('gnistby-ture', 'Ture', 'leader3', { x: 6, y: 2, facing: 'down' }, [[100, 20, ['thunder-shock', 'tackle', 'sonic-boom', 'spark']], [25, 23, ['thunder-shock', 'quick-attack', 'thunder-wave', 'slam']], [26, 26, ['thunderbolt', 'quick-attack', 'thunder-wave', 'slam']]], {
  badge: 'ture',
  badgeName: 'Gnistmärket',
  tm: 'thunderbolt',
  rewardDialog: [
    'Ha! Du tog dig igenom hela strömmen. Här, Gnistmärket är ditt!',
    'Och TM:en innehåller Thunderbolt. Den är riktigt kraftfull.',
  ],
}, {
  intro: ['Jag är Ture, Gnistbys gymledare!', 'Elektricitet är snabb. Är du snabbare? Det får vi se!'],
  defeated: ['Hm! Du knäckte min krets.'],
}))

export const gnistbyMaps = [m.build(), gym.build(), center.build(), mart.build(), dojo.build(), hus.build()]
