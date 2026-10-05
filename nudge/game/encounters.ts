// Wild Pokémon per map: weighted species with a level range. Species ids are PokeAPI ids.

export interface EncounterEntry {
  speciesId: number
  /** Relative weight. */
  weight: number
  minLevel: number
  maxLevel: number
}

export const ENCOUNTER_TABLES: Record<string, EncounterEntry[]> = {
  // Route 1: Pidgey, Rattata, a rare Spearow.
  route1: [
    { speciesId: 16, weight: 45, minLevel: 2, maxLevel: 4 },
    { speciesId: 19, weight: 45, minLevel: 2, maxLevel: 4 },
    { speciesId: 21, weight: 10, minLevel: 3, maxLevel: 4 },
  ],
  // Viridian Forest: bugs, a rare Pikachu.
  skogen: [
    { speciesId: 10, weight: 30, minLevel: 3, maxLevel: 5 }, // Caterpie
    { speciesId: 13, weight: 30, minLevel: 3, maxLevel: 5 }, // Weedle
    { speciesId: 11, weight: 10, minLevel: 4, maxLevel: 6 }, // Metapod
    { speciesId: 14, weight: 10, minLevel: 4, maxLevel: 6 }, // Kakuna
    { speciesId: 16, weight: 15, minLevel: 4, maxLevel: 6 }, // Pidgey
    { speciesId: 25, weight: 5, minLevel: 3, maxLevel: 6 }, // Pikachu
  ],
}

export type Rod = 'old' | 'good' | 'super'

/** Fishing: per table id and rod. Water next to a map without an entry here simply has no fish. */
export const FISHING_TABLES: Record<string, Partial<Record<Rod, EncounterEntry[]>>> = {}
