import { mapBuilder } from '../mapBuilder'
import { gymLeader, rivalTrainer, trainer } from '../trainerClasses'
import { enterable, road } from './layout'

// Harbour Town: a big seaside town with a Pokémon Center, a Mart that sells the evolution stones, the water gym and docks you can fish from.
const m = mapBuilder('hamn', 40, 30, { name: 'Hamnstad', music: 'grusstad', fishingTable: 'route3' })
m.border('tree', 2)
m.scatter(2, 2, 36, 20, 'tree', 6)
m.scatter(2, 2, 36, 22, 'flowers', 26)

// The harbour: sea in the south-east with docks of path.
m.fill(2, 23, 36, 5, 'water')
m.blob(33, 18, 6, 4, 'water', { roughness: 0.3 })
m.fill(2, 22, 36, 1, 'sand')
m.path([[8, 22], [8, 25]], { width: 2 })
m.path([[24, 22], [24, 26]], { width: 2 })
m.path([[33, 14], [33, 22]], { width: 2 })

// Streets.
road(m, 'w', 22, 'route3', 20)
// The road north (to Route 4, guarded until two badges) is added in P3-M6.
m.path([[1, 22], [30, 22]], { width: 1 })
m.path([[2, 12], [28, 12]], { width: 2 })
m.path([[19, 12], [19, 8]], { width: 2 })
m.path([[18, 1], [18, 8]], { width: 2 })
m.path([[6, 8], [6, 12]], { width: 1 })
m.path([[28, 8], [28, 12]], { width: 1 })
m.path([[6, 17], [6, 12]], { width: 1 })
m.path([[22, 17], [22, 12]], { width: 1 })

const gym = enterable(m, 'gym', 16, 4, 'hamn_gym', { name: 'Hamnstads gym', music: 'gym', floor: 'stone' })
const center = enterable(m, 'center', 4, 4, 'hamn_center', { name: 'Pokémon Center', music: 'center' })
const mart = enterable(m, 'mart', 26, 4, 'hamn_mart', { name: 'Pokémart', music: 'center' })
const hus1 = enterable(m, 'houseA', 4, 13, 'hamn_hus1', { name: 'Hus', music: 'home' })
const hus2 = enterable(m, 'houseD', 20, 13, 'hamn_hus2', { name: 'Hus', music: 'home' })
m.scenery('houseC', 12, 14)
m.sign(14, 11, ['HAMNSTAD', 'Havets port. Gym: Ledare Kajsa (vatten).'])
m.sign(10, 21, ['KAJEN', 'Fiska från bryggorna! Inga hopp i vattnet.'])
m.npc({
  id: 'hamn-sjoman', x: 11, y: 20, facing: 'down', look: 'boy',
  dialog: ['Stora fartyg kommer och går här. Men inga till havs idag.', 'Det sägs att ett Lapras visar sig för den som är värdig.'],
})
m.npc({
  id: 'hamn-turist', x: 22, y: 19, facing: 'left', look: 'girl',
  dialog: ['Min pappa är fiskare. Han säger att Superspöet fångar de ovanliga fiskarna!'],
})
m.pickup({ id: 'hamn-ball', x: 26, y: 17, item: 'poke-ball', hidden: true })
m.pickup({ id: 'hamn-antidote', x: 3, y: 21, item: 'antidote' })
m.trainer(rivalTrainer('rival-2', 2, { x: 24, y: 20, facing: 'auto', sight: 5 }, {
  intro: ['Hej! Här är du! Jag har tränat som en galning sedan sist!', 'Låt oss se vem som är starkast nu!'],
  defeated: ['Hur?! Du är otroligt stark...', 'Jag tänker inte ge upp! Jag drar vidare österut. Vi ses!'],
}))
m.trainer(trainer('hamn-doris', 'Doris', 'swimmer', { x: 14, y: 22, facing: 'auto' }, [[54, 17], [60, 17], [118, 18]], { sprite: 'lass' }))
m.trainer(trainer('hamn-roger', 'Roger', 'sailor', { x: 27, y: 21, facing: 'auto' }, [[66, 17], [98, 18], [67, 18]]))

center
  .fill(3, 3, 5, 1, 'counter')
  .npc({
    id: 'hamn-sjukskoterska', x: 5, y: 2, facing: 'down', look: 'nurse', action: 'heal', name: 'Sjuksköterska',
    dialog: ['Välkommen till Hamnstads Pokémon Center! Ska jag ta hand om dina Pokémon?', 'Klart! Dina Pokémon är friska igen.'],
  })
  .npc({ id: 'hamn-pc', x: 8, y: 1, facing: 'down', look: 'pc', action: 'pc', name: 'PC', dialog: ['Du loggade in på Pokémon-lagringen.'] })
  .npc({
    id: 'hamn-resekarta', x: 2, y: 1, facing: 'down', look: 'pc', action: 'travel', name: 'Resekarta',
    dialog: ['Snabbresekartan visar alla Pokémon Center du har besökt.'],
  })

mart
  .fill(2, 3, 7, 1, 'counter')
  .fill(1, 1, 9, 1, 'shelf')
  .npc({
    id: 'hamn-expedit', x: 5, y: 2, facing: 'down', look: 'clerk', action: 'shop', name: 'Expedit',
    dialog: ['Välkommen till den stora butiken i Hamnstad! Här säljer vi även utvecklingsstenar.'],
  })

hus1
  .fill(1, 1, 2, 1, 'bed')
  .npc({
    id: 'hamn-eevee-pappa', x: 4, y: 3, facing: 'left', look: 'old', name: 'Pokémonuppfödare', action: 'give',
    dialog: ['Min Eevee har fått ungar, och jag har inte plats för alla.', 'Vill du ha en? Den kan utvecklas på tre olika sätt, med stenar!'],
    dialogAfter: { flag: 'eevee', lines: ['Ta väl hand om den. Eevee är fylld av möjligheter!'] },
    give: { flag: 'eevee', pokemon: [{ speciesId: 133, level: 15 }] },
  })

hus2
  .fill(1, 1, 4, 1, 'shelf')
  .npc({
    id: 'hamn-spoe', x: 3, y: 3, facing: 'down', look: 'old', name: 'Gammal sjöbjörn',
    dialog: ['I mitt unga år fångade jag en stor fisk. Den var DEN STÖRSTA.', 'Jag hittade ett spö i botten av havet en gång. Kanske finns det fler i skymundan.'],
  })

gym
  .fill(2, 5, 2, 1, 'counter')
  .fill(9, 5, 2, 1, 'counter')
  .fill(0, 8, 2, 4, 'water')
  .fill(11, 8, 2, 4, 'water')
gym.trainer(trainer('hamn-gym-1', 'Marina', 'gymstudent', { x: 9, y: 7, facing: 'left', sight: 5 }, [[72, 16], [72, 17]], {
  sprite: 'lass', intro: ['Välkommen till Hamnstads gym! Vattnet är kallt, och det är jag också!'], defeated: ['Svalt! Du var starkare än tidvattnet.'],
}))
gym.trainer(trainer('hamn-gym-2', 'Sture', 'swimmer', { x: 3, y: 11, facing: 'right', sight: 6 }, [[54, 17], [118, 17], [60, 18]], {
  title: 'Gymelev', intro: ['Kajsa kommer inte att prata med dig om du inte klarar mig först!'], defeated: ['Jag sjönk... men du simmade förbi.'],
}))
gym.trainer(gymLeader('hamn-kajsa', 'Kajsa', 'leader2', { x: 6, y: 2, facing: 'down' }, [[120, 18], [121, 21]], {
  badge: 'kajsa',
  badgeName: 'Vågmärket',
  tm: 'water-pulse',
  rewardDialog: [
    'Härligt! Du simmade rakt genom mina vågor. Här, ta Vågmärket!',
    'Och TM:en innehåller Water Pulse. Använd den väl.',
  ],
}, {
  intro: ['Jag är Kajsa, Hamnstads gymledare!', 'Vatten är mjukt men det formar berg. Visa mig att dina Pokémon kan stå emot tidvattnet!'],
  defeated: ['Hm! Du har strömmen med dig.'],
}))

export const hamnMaps = [m.build(), gym.build(), center.build(), mart.build(), hus1.build(), hus2.build()]
