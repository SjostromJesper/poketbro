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
  // Route 2: Nidoran, Mankey, Ekans and Sandshrew in the grass, Jigglypuff now and then.
  route2: [
    { speciesId: 29, weight: 14, minLevel: 8, maxLevel: 12 }, // Nidoran♀
    { speciesId: 32, weight: 14, minLevel: 8, maxLevel: 12 }, // Nidoran♂
    { speciesId: 56, weight: 12, minLevel: 9, maxLevel: 13 }, // Mankey
    { speciesId: 23, weight: 12, minLevel: 8, maxLevel: 12 }, // Ekans
    { speciesId: 27, weight: 12, minLevel: 8, maxLevel: 12 }, // Sandshrew
    { speciesId: 16, weight: 14, minLevel: 8, maxLevel: 11 }, // Pidgey
    { speciesId: 19, weight: 12, minLevel: 8, maxLevel: 11 }, // Rattata
    { speciesId: 39, weight: 4, minLevel: 9, maxLevel: 12 }, // Jigglypuff (rare)
    { speciesId: 21, weight: 6, minLevel: 9, maxLevel: 12 }, // Spearow
  ],
  // Moon Mountain: bats, rocks and mushrooms, Clefairy rarely.
  manberget: [
    { speciesId: 41, weight: 34, minLevel: 9, maxLevel: 13 }, // Zubat
    { speciesId: 74, weight: 26, minLevel: 10, maxLevel: 13 }, // Geodude
    { speciesId: 46, weight: 18, minLevel: 10, maxLevel: 13 }, // Paras
    { speciesId: 50, weight: 12, minLevel: 10, maxLevel: 13 }, // Diglett
    { speciesId: 35, weight: 4, minLevel: 11, maxLevel: 14 }, // Clefairy (rare)
    { speciesId: 66, weight: 6, minLevel: 11, maxLevel: 14 }, // Machop
  ],
  // Route 3: the beach and the grass behind it.
  route3: [
    { speciesId: 52, weight: 20, minLevel: 13, maxLevel: 17 }, // Meowth
    { speciesId: 54, weight: 16, minLevel: 13, maxLevel: 17 }, // Psyduck
    { speciesId: 98, weight: 20, minLevel: 13, maxLevel: 17 }, // Krabby
    { speciesId: 69, weight: 20, minLevel: 13, maxLevel: 17 }, // Bellsprout
    { speciesId: 21, weight: 10, minLevel: 13, maxLevel: 16 }, // Spearow
    { speciesId: 19, weight: 8, minLevel: 13, maxLevel: 16 }, // Rattata
    { speciesId: 27, weight: 6, minLevel: 14, maxLevel: 18 }, // Sandshrew
  ],
}

export type Rod = 'old' | 'good' | 'super'

/** Fishing: per table id and rod. Water next to a map without an entry here simply has no fish. */
export const FISHING_TABLES: Record<string, Partial<Record<Rod, EncounterEntry[]>>> = {
  // Route 3 and the harbour: Magikarp on the old rod, Poliwag / Goldeen / Tentacool on the better ones.
  route3: {
    old: [{ speciesId: 129, weight: 1, minLevel: 5, maxLevel: 10 }],
    good: [
      { speciesId: 129, weight: 3, minLevel: 10, maxLevel: 15 },
      { speciesId: 60, weight: 4, minLevel: 12, maxLevel: 17 }, // Poliwag
      { speciesId: 118, weight: 4, minLevel: 12, maxLevel: 17 }, // Goldeen
      { speciesId: 72, weight: 3, minLevel: 13, maxLevel: 17 }, // Tentacool
    ],
    super: [
      { speciesId: 118, weight: 3, minLevel: 15, maxLevel: 22 },
      { speciesId: 72, weight: 3, minLevel: 15, maxLevel: 22 },
      { speciesId: 60, weight: 3, minLevel: 15, maxLevel: 22 },
      { speciesId: 119, weight: 2, minLevel: 18, maxLevel: 24 }, // Seaking
      { speciesId: 61, weight: 2, minLevel: 18, maxLevel: 24 }, // Poliwhirl
    ],
  },
}

