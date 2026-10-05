import { mapBuilder } from '../mapBuilder'
import { gymLeader, trainer } from '../trainerClasses'
import { enterable, road } from './layout'

// Gravel Town: the Pokémon Center (left), the Mart (right) and the rock-type gym (top). The road east to Route 2 is guarded until you hold the Granit badge.
const m = mapBuilder('gruss', 36, 28, { name: 'Grusstad', music: 'grusstad' })
m.border('tree', 2)
m.scatter(2, 2, 32, 24, 'tree', 10)
m.scatter(2, 12, 32, 14, 'flowers', 26)
m.scatter(2, 2, 32, 24, 'rock', 8)

// Streets: the avenue to the gym, the main street and the roads out.
road(m, 's', 16, 'skogen', 14)
road(m, 'e', 13, 'route2', 33, {
  requiresBadges: 1,
  blockedDialog: ['Vakten står i vägen. "Ingen får gå till Väg 2 utan Granitmärket!"'],
})
m.path([[17, 26], [17, 6]], { width: 2 })
m.path([[4, 12], [34, 12]], { width: 2 })
m.path([[6, 8], [6, 12]], { width: 1 })
m.path([[28, 8], [28, 12]], { width: 1 })
m.path([[6, 19], [6, 12]], { width: 1 })
m.blob(28, 21, 4, 2, 'water')
m.fill(22, 16, 6, 1, 'fence')
m.fill(3, 17, 4, 1, 'fence')

const gym = enterable(m, 'gym', 15, 1, 'gruss_gym', { name: 'Grusstads gym', music: 'gym', floor: 'stone' })
const center = enterable(m, 'center', 4, 3, 'gruss_center', { name: 'Pokémon Center', music: 'center' })
const mart = enterable(m, 'mart', 26, 3, 'gruss_mart', { name: 'Pokémart', music: 'center' })
const hus = enterable(m, 'houseB', 10, 15, 'gruss_hus1', { name: 'Hus', music: 'home' })
m.scenery('houseC', 24, 17)
m.sign(14, 13, ['GRUSSTAD', 'Stenig stad. Gym: Ledare Granit.'])
m.sign(33, 10, ['VÄG 2', 'Österut. Du behöver Granitmärket för att få gå dit.'])
m.npc({
  id: 'gruss-pojke', x: 20, y: 14, facing: 'left', look: 'boy',
  dialog: ['Granit är gymledare här. Hans Pokémon är hårda som sten!', 'Vatten och gräs brukar fungera bra mot honom.'],
})
m.npc({
  id: 'gruss-tjej', x: 8, y: 14, facing: 'down', look: 'girl',
  dialog: ['Pokémon Center läker alla dina Pokémon gratis!', 'Prata med sjuksköterskan vid disken.'],
})
for (const y of [13, 14]) {
  m.npc({
    id: `gruss-vakt-${y}`, x: 31, y, facing: 'right', look: 'old', name: 'Vakt', gate: { badges: 1 },
    dialog: ['Väg 2 är stängd för tränare utan Granitmärket.', 'Slå gymledaren Granit här i staden först!'],
  })
}
m.pickup({ id: 'gruss-ball', x: 31, y: 24, item: 'poke-ball', hidden: true })

// The Pokémon Center: nurse, PC and the fast-travel map.
center
  .fill(3, 3, 5, 1, 'counter')
  .npc({
    id: 'sjukskoterska', x: 5, y: 2, facing: 'down', look: 'nurse', action: 'heal', name: 'Sjuksköterska',
    dialog: ['Välkommen till Pokémon Center! Ska jag ta hand om dina Pokémon?', 'Klart! Dina Pokémon är friska igen. Välkommen åter!'],
  })
  .npc({ id: 'pc', x: 8, y: 1, facing: 'down', look: 'pc', action: 'pc', name: 'PC', dialog: ['Du loggade in på Pokémon-lagringen.'] })
  .npc({
    id: 'resekarta', x: 2, y: 1, facing: 'down', look: 'pc', action: 'travel', name: 'Resekarta',
    dialog: ['Snabbresekartan visar alla Pokémon Center du har besökt.'],
  })

mart
  .fill(2, 3, 5, 1, 'counter')
  .fill(1, 1, 7, 1, 'shelf')
  .npc({
    id: 'expedit', x: 4, y: 2, facing: 'down', look: 'clerk', action: 'shop', name: 'Expedit',
    dialog: ['Välkommen till Pokémart! Vad önskas?'],
  })

hus
  .fill(1, 1, 2, 1, 'bed')
  .npc({
    id: 'gruss-farmor', x: 4, y: 2, facing: 'down', look: 'old', dialog: ['Lugna stan, va? Men gymmet är hårt.', 'Tänk på att lägga in lite vatten i laget.'],
  })

gym
  .fill(2, 5, 2, 1, 'counter')
  .fill(9, 5, 2, 1, 'counter')
  .fill(2, 9, 2, 1, 'counter')
  .fill(9, 9, 2, 1, 'counter')
gym.trainer(trainer('gym-tor', 'Tor', 'gymstudent', { x: 9, y: 7, facing: 'left', sight: 5 }, [[74, 11], [50, 11]], {
  sprite: 'karate', intro: ['Det här är Granits gym! För att nå honom måste du först slå mig!'], defeated: ['Du är stark! Men Granit är hårdare än sten.'],
}))
gym.trainer(trainer('gym-sofia', 'Sofia', 'gymstudent', { x: 2, y: 11, facing: 'right', sight: 6 }, [[27, 12]], {
  sprite: 'lass', title: 'Gymelev', intro: ['Sten och mark, det är vår stil. Redo?'], defeated: ['Du krossade mig som en lerklump...'],
}))
gym.trainer(gymLeader('gym-granit', 'Granit', 'leader1', { x: 6, y: 2, facing: 'down' }, [[74, 12], [95, 14]], {
  badge: 'granit',
  badgeName: 'Granitmärket',
  tm: 'rock-tomb',
  rewardDialog: [
    'Här, ta Granitmärket! Det bevisar att du besegrat Grusstads gym.',
    'Och ta den här TM:en också. Den innehåller Rock Tomb!',
  ],
}, {
  intro: ['Jag är Granit, Grusstads gymledare!', 'Min försvarsstrategi är lika hård som sten. Kan dina Pokémon knäcka den?'],
  defeated: ['Hm! Jag erkänner mig besegrad.'],
}))

export const grussMaps = [m.build(), gym.build(), center.build(), mart.build(), hus.build()]
