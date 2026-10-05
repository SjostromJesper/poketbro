import { mapBuilder } from '../mapBuilder'
import { rivalTrainer, trainer } from '../trainerClasses'
import { road } from './layout'

// Route 6: a lake with a forest around it. Fish from the shore (Super Rod!), meet the rival one last time before Bloomtown and walk on east.
const m = mapBuilder('route6', 42, 34, { name: 'Väg 6', music: 'skogen', encounterTable: 'route6', fishingTable: 'route6' })
m.border('tree', 2)
m.scatter(2, 2, 38, 30, 'tree', 150)
m.scatter(2, 2, 38, 30, 'flowers', 30)

m.path([[8, 32], [8, 24], [20, 24], [20, 16], [40, 16]], { width: 2, wobble: 0.15 })
road(m, 's', 8, 'route5', 14)
road(m, 'e', 16, 'blomstad', 14)

// The lake in the north-east and a pond in the south-west.
m.blob(30, 8, 8, 4, 'water', { roughness: 0.3 })
m.blob(34, 22, 3, 2, 'water', { roughness: 0.3 })
m.blob(30, 12, 8, 1, 'sand', { roughness: 0.4, onlyOn: '.#o' })
m.path([[20, 16], [20, 11], [26, 11]], { width: 1 })
m.blob(14, 20, 4, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(26, 20, 5, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(12, 28, 4, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(14, 10, 4, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(34, 28, 4, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(24, 29, 3, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(8, 14, 3, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })

m.pickup({ id: 'r6-super', x: 15, y: 27, item: 'super-potion' })
m.pickup({ id: 'r6-leaf', x: 4, y: 7, item: 'leaf-stone', hidden: true })
m.pickup({ id: 'r6-ball', x: 36, y: 25, item: 'ultra-ball', hidden: true })
m.pickup({ id: 'r6-water', x: 22, y: 5, item: 'water-stone', hidden: true })
m.pickup({ id: 'r6-berry', x: 38, y: 19, item: 'oran-berry' })
m.sign(10, 31, ['VÄG 6', 'Sjön med fisk, skogen med skatter. Blomstad österut.'])
m.sign(19, 12, ['SJÖN', 'Fiska från stranden. Bästa fångsten med Superspöet!'])
m.npc({
  id: 'r6-fiskare', x: 24, y: 12, facing: 'up', look: 'old', name: 'Fiskare',
  dialog: ['Sjön här är full av fisk. Men de riktigt stora tar bara Superspöet.', 'Du hittar ett i Spöktornet, sägs det.'],
})
m.npc({
  id: 'r6-botanikern', x: 14, y: 15, facing: 'down', look: 'girl',
  dialog: ['Jag samlar ovanliga växter. Pinsir och Scyther älskar skogen här, men de är sällsynta!'],
})
m.trainer(rivalTrainer('rival-3', 3, { x: 14, y: 26, facing: 'auto', sight: 5 }, {
  intro: ['Där är du, äntligen! Jag har tränat som aldrig förr.', 'Fyra gymmärken, eller hur? Det har jag med! Nu avgör vi det här en gång för alla!'],
  defeated: ['Jag... jag förlorade igen.', 'Okej. Du är faktiskt bättre. Men nästa gång tar jag dig!', 'Jag tänker träna i Vildmarken. Kanske ses vi där!'],
}))
m.trainer(trainer('r6-stefan', 'Stefan', 'fisher', { x: 22, y: 12, facing: 'auto' }, [[118, 24], [119, 25], [72, 25]]))
m.trainer(trainer('r6-karin', 'Karin', 'picnicker', { x: 8, y: 28, facing: 'auto' }, [[102, 24], [44, 24], [102, 25]]))
m.trainer(trainer('r6-anders', 'Anders', 'bugcatcher', { x: 12, y: 24, facing: 'auto' }, [[123, 25], [127, 25], [49, 26]]))
m.trainer(trainer('r6-ulla', 'Ulla', 'lass', { x: 16, y: 22, facing: 'auto' }, [[70, 24], [44, 25], [114, 26]]))
m.trainer(trainer('r6-pontus', 'Pontus', 'scientist', { x: 20, y: 20, facing: 'auto' }, [[82, 25], [101, 26], [109, 26]]))
m.trainer(trainer('r6-saga', 'Siv', 'picnicker', { x: 26, y: 18, facing: 'auto' }, [[47, 25], [70, 26], [71, 27]]))
m.trainer(trainer('r6-bengt', 'Bengt', 'fisher', { x: 34, y: 18, facing: 'auto' }, [[79, 25], [60, 26], [129, 27]], {}))
m.trainer(trainer('r6-emil', 'Emil', 'youngster', { x: 28, y: 14, facing: 'auto' }, [[84, 25], [85, 26], [77, 26]]))
m.trainer(trainer('r6-ylva', 'Ylva', 'psychic', { x: 36, y: 14, facing: 'auto' }, [[96, 26], [97, 27], [63, 25]]))

export const route6 = m.build()
