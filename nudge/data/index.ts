// Loads the generated PokeAPI JSON (see nudge/scripts/fetch-data.ts) into a GameData registry.
import pokemonJson from './pokemon.json'
import movesJson from './moves.json'
import typesJson from './types.json'
import naturesJson from './natures.json'
import growthRatesJson from './growth-rates.json'
import itemsJson from './items.json'
import type { GameData, GrowthRates, ItemData, MoveData, NatureData, SpeciesData, TypeChart } from './types'

const speciesList = pokemonJson as unknown as SpeciesData[]
const natureList = naturesJson as unknown as NatureData[]

export const gameData: GameData = {
  species: Object.fromEntries(speciesList.map(s => [s.id, s])),
  moves: movesJson as unknown as Record<string, MoveData>,
  typeChart: typesJson as unknown as TypeChart,
  natures: Object.fromEntries(natureList.map(n => [n.name, n])),
  growthRates: growthRatesJson as unknown as GrowthRates,
  items: itemsJson as unknown as Record<string, ItemData>,
}

export * from './types'
