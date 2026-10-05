import { rivalTrainer, trainer } from '../trainerClasses'
import { mapBuilder } from '../mapBuilder'
import { road } from './layout'

// A long, winding route north from Hemstad: three tall-grass fields, a ledge shortcut with a hidden item, three trainers and the rival.
const m = mapBuilder('route1', 22, 46, { name: 'Väg 1', music: 'route1', encounterTable: 'route1' })
m.border('tree', 2)
m.scatter(2, 2, 18, 42, 'tree', 36)
m.scatter(2, 2, 18, 42, 'flowers', 30)

m.path([[10, 44], [10, 40], [6, 40], [6, 31], [12, 31], [12, 21], [8, 21], [8, 11], [10, 11], [10, 1]], { width: 2, wobble: 0.2 })
road(m, 's', 10, 'hemstad', 14)
road(m, 'n', 10, 'skogen', 14)

// Tall grass in fields of different shapes beside the road.
m.blob(15, 37, 3, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(3, 35, 2, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(16, 27, 3, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(4, 26, 2, 2, 'grass', { roughness: 0.2, onlyOn: '.#o' })
m.blob(15, 16, 3, 3, 'grass', { roughness: 0.35, onlyOn: '.#o' })
m.blob(4, 14, 2, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(15, 6, 3, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })

// A little shortcut behind a ledge, with a hidden potion.
m.fill(14, 21, 5, 4, 'ground')
m.ledge(14, 20, 5)
m.pickup({ id: 'r1-potion', x: 17, y: 23, item: 'potion', hidden: true })
m.pickup({ id: 'r1-ball', x: 5, y: 17, item: 'poke-ball' })

m.sign(12, 41, ['VÄG 1', 'Hemstad söderut. Viridianskogen norrut.'])
m.npc({
  id: 'r1-vandrare', x: 9, y: 33, facing: 'right', look: 'hiker',
  dialog: ['Högt gräs! Där gömmer sig vilda Pokémon.', 'Försvaga dem först, så går de lättare att fånga med en Poké Ball.'],
})
m.trainer(trainer('r1-kalle', 'Kalle', 'youngster', { x: 10, y: 28, facing: 'auto', sight: 3 }, [[19, 3], [16, 3]], {
  intro: ['Hallå där! Du har ju en Pokémon! Då slåss vi!'],
  defeated: ['Aj aj aj! Du var starkare än jag trodde.', 'Fortsätt norrut, det finns mer att se i skogen.'],
}))
m.trainer(trainer('r1-lisa', 'Lisa', 'lass', { x: 9, y: 17, facing: 'auto', sight: 3 }, [[16, 4], [19, 3]], {
  intro: ['Stopp! Du ska inte gå förbi utan att slåss!'],
  defeated: ['Åh nej! Mina Pokémon!', 'Du är bra. Skogen norrut är full av insekter, så se upp!'],
}))
m.trainer(trainer('r1-nils', 'Nils', 'youngster', { x: 11, y: 36, facing: 'auto', sight: 3 }, [[19, 4], [21, 3]]))
m.trainer(rivalTrainer('rival-1', 1, { x: 9, y: 5, facing: 'auto', sight: 4 }, {
  intro: ['Där är du, {player}! Jag har väntat på dig!', 'Jag fick en Pokémon av professorn jag också. Låt oss se vem som är bäst!'],
  defeated: ['Va?! Jag förlorade?!', 'Du har tur den här gången. Nästa gång krossar jag dig!', 'Jag drar vidare till Grusstad. Ses där!'],
}))

export const route1 = m.build()
