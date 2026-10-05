// Prints a report about the world: warps, reachability (with the badge gates), entities, Pokémon/moves, and how many of the 151 species
// can be obtained. Run with `npm run check-world`. The same checks run as tests (`world.test.ts`).
import { gameData } from '../data'
import { describeSources, obtainable } from '../game/pokedex'
import { coverage, entityProblems, pokemonProblems, reachability, warpProblems } from '../game/worldCheck'

const warps = warpProblems()
const r = reachability()
const entities = entityProblems()
const pokemon = pokemonProblems(gameData)
const c = coverage(gameData)

console.log(`Maps reachable from Hemstad: ${r.maps.length}${r.unreachable.length ? ` (UNREACHABLE: ${r.unreachable.join(', ')})` : ''}`)
console.log(`Badges won in order of reach: ${r.badges.join(', ') || '-'}`)
console.log(`Warp problems: ${warps.length}`)
for (const p of warps) console.log(`  ${p}`)
console.log(`Entity problems: ${entities.length}`)
for (const p of entities) console.log(`  ${p}`)
console.log(`Pokémon/move problems: ${pokemon.length}`)
for (const p of pokemon) console.log(`  ${p}`)
console.log(`\nObtainable species (not counting legendaries, Mew and Mewtwo): ${c.count} of ${c.count + c.missing.length}`)
console.log(`Missing: ${c.missing.map(id => gameData.species[id].displayName).join(', ') || '-'}`)
if (process.argv.includes('--list')) {
  const sources = obtainable(gameData)
  for (const id of c.obtainable) console.log(`  #${id} ${gameData.species[id].displayName}: ${describeSources(gameData, sources.get(id) ?? []).join('; ')}`)
}
process.exitCode = warps.length + entities.length + pokemon.length + r.unreachable.length > 0 ? 1 : 0
