import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { linkStairs, stairs } from './layout'

// The ghost tower: three floors of dark stone. Optional, but the old man on the top floor gives the Super Rod to anyone who gets there.
const tower = (id: string, name: string) => mapBuilder(id, 22, 18, { name, music: 'spooky', encounterTable: 'spoktornet', base: 'cavewall', ground: 'cave' })

// ---- 1F
const f1 = tower('spoktornet_1', 'Spöktornet 1V')
f1.path([[11, 15], [11, 12]], { width: 2, tile: 'cave' })
f1.blob(11, 11, 6, 3, 'cave', { roughness: 0.25 })
f1.path([[11, 11], [5, 11], [5, 6]], { width: 2, tile: 'cave', wobble: 0.1 })
f1.blob(5, 5, 3, 2, 'cave', { roughness: 0.25 })
f1.path([[11, 11], [17, 11], [17, 4]], { width: 2, tile: 'cave', wobble: 0.1 })
f1.fill(11, 16, 1, 1, 'cave')
f1.scatter(2, 2, 18, 14, 'cavewall', 10, { onlyOn: 'c' })
stairs(f1, 11, 16, 'route5', 27, 8)
f1.pickup({ id: 'st1-ball', x: 5, y: 4, item: 'great-ball' })
f1.pickup({ id: 'st1-antidote', x: 12, y: 13, item: 'antidote', hidden: true })
f1.trainer(trainer('st1-vilgot', 'Vilgot', 'psychic', { x: 11, y: 12, facing: 'down', sight: 4 }, [[92, 20], [92, 21], [93, 22]], { sprite: 'psychic' }))
f1.trainer(trainer('st1-astrid', 'Astrid', 'psychic', { x: 7, y: 11, facing: 'right', sight: 4 }, [[96, 21], [92, 22], [97, 23]]))
f1.trainer(trainer('st1-hugo', 'Hugo', 'youngster', { x: 14, y: 11, facing: 'left', sight: 4 }, [[41, 21], [92, 21], [104, 22]]))

// ---- 2F
const f2 = tower('spoktornet_2', 'Spöktornet 2V')
f2.path([[4, 14], [4, 10], [16, 10], [16, 5]], { width: 2, tile: 'cave', wobble: 0.1 })
f2.blob(10, 11, 5, 3, 'cave', { roughness: 0.25 })
f2.blob(16, 4, 3, 2, 'cave', { roughness: 0.25 })
f2.scatter(2, 2, 18, 14, 'cavewall', 8, { onlyOn: 'c' })
linkStairs(f1, 17, 3, f2, 4, 13)
f2.pickup({ id: 'st2-hyper', x: 9, y: 12, item: 'hyper-potion' })
f2.pickup({ id: 'st2-tm', x: 18, y: 4, item: 'tm:night-shade', hidden: true })
f2.trainer(trainer('st2-sixten', 'Sixten', 'psychic', { x: 10, y: 10, facing: 'left', sight: 4 }, [[93, 23], [96, 22], [93, 24]]))
f2.trainer(trainer('st2-ingrid', 'Ingrid', 'scientist', { x: 16, y: 7, facing: 'down', sight: 4 }, [[109, 23], [88, 23], [110, 24]]))

// ---- 3F
const f3 = tower('spoktornet_3', 'Spöktornet 3V')
f3.path([[5, 14], [5, 10], [15, 10]], { width: 2, tile: 'cave' })
f3.blob(16, 8, 3, 3, 'cave', { roughness: 0.2 })
f3.scatter(2, 2, 18, 14, 'cavewall', 6, { onlyOn: 'c' })
linkStairs(f2, 16, 3, f3, 5, 13)
f3.npc({
  id: 'st3-gubbe', x: 16, y: 8, facing: 'down', look: 'old', name: 'Gammal man', action: 'give',
  dialog: [
    'Hihi... en besökare! Det var längesedan.',
    'Jag har suttit här och fiskat i mörkret i trettio år. Du vågade dig ända hit, så du förtjänar mitt bästa spö.',
  ],
  dialogAfter: { flag: 'super-rod', lines: ['Superspöet fångar de ovanliga fiskarna. Prova i Hamnstad eller vid sjön på Väg 6!'] },
  give: { flag: 'super-rod', items: [{ item: 'super-rod', count: 1 }] },
})
f3.trainer(trainer('st3-nora', 'Nora', 'psychic', { x: 9, y: 10, facing: 'left', sight: 4 }, [[93, 25], [97, 24], [94, 26]]))

export const spoktornetMaps = [f1.build(), f2.build(), f3.build()]
