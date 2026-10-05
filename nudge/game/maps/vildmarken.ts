import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { road } from './layout'

// The Wilderness: the far east, open to anyone with four badges. Rare Pokémon in the grass, a big lake with the rarest fish and Lapras waiting
// at the shore for a trainer who made it this far.
const m = mapBuilder('vildmarken', 46, 44, { name: 'Vildmarken', music: 'skogen', encounterTable: 'vildmarken', fishingTable: 'vildmarken' })
m.border('tree', 2)
m.scatter(2, 2, 42, 40, 'tree', 220)
m.scatter(2, 2, 42, 40, 'flowers', 40)
m.scatter(2, 2, 42, 40, 'rock', 20, { onlyOn: '.' })

m.path([[1, 22], [12, 22], [12, 12], [28, 12], [28, 28], [36, 28]], { width: 2, wobble: 0.15 })
m.path([[12, 22], [12, 34], [22, 34]], { width: 1, wobble: 0.1 })
road(m, 'w', 22, 'blomstad', 14)

m.blob(37, 33, 7, 4, 'water', { roughness: 0.3 })
m.blob(36, 29, 7, 1, 'sand', { roughness: 0.3, onlyOn: '.#o' })
m.blob(38, 8, 5, 3, 'water', { roughness: 0.3 })
for (const [x, y, rx, ry] of [[20, 17, 4, 3], [20, 26, 4, 3], [34, 16, 4, 3], [8, 17, 3, 3], [8, 28, 3, 3], [18, 38, 4, 2], [30, 38, 4, 2], [40, 18, 3, 3], [20, 6, 5, 2]]) {
  m.blob(x, y, rx, ry, 'grass', { roughness: 0.3, onlyOn: '.#o' })
}

m.pickup({ id: 'vm-hyper', x: 30, y: 24, item: 'hyper-potion' })
m.pickup({ id: 'vm-moon', x: 6, y: 10, item: 'moon-stone', hidden: true })
m.pickup({ id: 'vm-ultra', x: 24, y: 40, item: 'ultra-ball', hidden: true })
m.pickup({ id: 'vm-leftovers', x: 40, y: 12, item: 'leftovers', hidden: true })
m.pickup({ id: 'vm-tm', x: 16, y: 38, item: 'tm:psychic', hidden: true })
m.pickup({ id: 'vm-water', x: 42, y: 24, item: 'water-stone', hidden: true })
m.pickup({ id: 'vm-quick', x: 4, y: 34, item: 'quick-claw', hidden: true })
m.sign(3, 20, ['VILDMARKEN', 'Här slutar de utstakade stigarna. Stranden i sydost är bäst för fiskare.'])
m.npc({
  id: 'vm-lapras-skotare', x: 37, y: 28, facing: 'left', look: 'old', name: 'Skötaren', action: 'give',
  dialog: [
    'Du har kommit hela vägen hit. Då är du en riktig tränare.',
    'Det här är ett Lapras. Hon har bott vid sjön i åratal och väntat på någon som hon litar på. Ta henne!',
  ],
  dialogAfter: { flag: 'lapras', lines: ['Lapras sjunger när hon är glad. Lyssna på henne.'] },
  give: { flag: 'lapras', pokemon: [{ speciesId: 131, level: 25 }] },
})
m.npc({
  id: 'vm-vandrare', x: 14, y: 24, facing: 'right', look: 'hiker',
  dialog: ['Jag har sett Snorlax sova i gräset här! Men det var längesedan.', 'Det finns Pokémon här som inte finns någon annanstans. Se dig om!'],
})
m.trainer(trainer('vm-ake', 'Åke', 'hiker', { x: 10, y: 22, facing: 'auto' }, [[75, 27], [111, 27], [95, 28]]))
m.trainer(trainer('vm-selma', 'Selma', 'psychic', { x: 12, y: 16, facing: 'auto' }, [[97, 27], [64, 28], [122, 29]]))
m.trainer(trainer('vm-henrik', 'Henrik', 'scientist', { x: 18, y: 12, facing: 'auto' }, [[82, 27], [101, 28], [137, 28]]))
m.trainer(trainer('vm-ebba', 'Ebba', 'lass', { x: 24, y: 12, facing: 'auto' }, [[45, 28], [103, 29], [71, 28]]))
m.trainer(trainer('vm-gert', 'Gert', 'karate', { x: 28, y: 18, facing: 'auto' }, [[67, 28], [107, 30], [106, 30]]))
m.trainer(trainer('vm-inga', 'Inga', 'picnicker', { x: 28, y: 24, facing: 'auto' }, [[113, 28], [40, 29], [35, 29]]))
m.trainer(trainer('vm-stig', 'Stig', 'fisher', { x: 33, y: 28, facing: 'auto' }, [[119, 28], [121, 30], [131, 30]]))
m.trainer(trainer('vm-lisbeth', 'Lisbeth', 'psychic', { x: 14, y: 34, facing: 'auto' }, [[94, 29], [65, 30], [97, 30]]))
m.trainer(trainer('vm-tor', 'Torbjörn', 'hiker', { x: 20, y: 34, facing: 'auto' }, [[76, 29], [112, 30], [68, 31]]))

export const vildmarken = m.build()
