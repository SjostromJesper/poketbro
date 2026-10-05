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
  // Route 4: the meadow.
  route4: [
    { speciesId: 43, weight: 18, minLevel: 17, maxLevel: 21 }, // Oddish
    { speciesId: 48, weight: 14, minLevel: 17, maxLevel: 21 }, // Venonat
    { speciesId: 77, weight: 10, minLevel: 18, maxLevel: 22 }, // Ponyta
    { speciesId: 58, weight: 8, minLevel: 18, maxLevel: 21 }, // Growlithe
    { speciesId: 37, weight: 8, minLevel: 18, maxLevel: 21 }, // Vulpix
    { speciesId: 84, weight: 12, minLevel: 17, maxLevel: 21 }, // Doduo
    { speciesId: 69, weight: 12, minLevel: 17, maxLevel: 20 }, // Bellsprout
    { speciesId: 52, weight: 10, minLevel: 17, maxLevel: 20 }, // Meowth
    { speciesId: 63, weight: 5, minLevel: 16, maxLevel: 20 }, // Abra (rare)
    { speciesId: 128, weight: 2, minLevel: 20, maxLevel: 23 }, // Tauros (very rare)
  ],
  // The power plant: machines, sparks and fumes.
  kraftverket: [
    { speciesId: 81, weight: 30, minLevel: 18, maxLevel: 23 }, // Magnemite
    { speciesId: 100, weight: 26, minLevel: 18, maxLevel: 23 }, // Voltorb
    { speciesId: 25, weight: 14, minLevel: 18, maxLevel: 22 }, // Pikachu
    { speciesId: 88, weight: 10, minLevel: 19, maxLevel: 23 }, // Grimer
    { speciesId: 109, weight: 12, minLevel: 19, maxLevel: 23 }, // Koffing
    { speciesId: 125, weight: 3, minLevel: 22, maxLevel: 26 }, // Electabuzz (very rare)
  ],
  // Route 5: the mountain road.
  route5: [
    { speciesId: 111, weight: 14, minLevel: 21, maxLevel: 26 }, // Rhyhorn
    { speciesId: 95, weight: 10, minLevel: 21, maxLevel: 26 }, // Onix
    { speciesId: 104, weight: 14, minLevel: 21, maxLevel: 25 }, // Cubone
    { speciesId: 66, weight: 14, minLevel: 21, maxLevel: 25 }, // Machop
    { speciesId: 74, weight: 12, minLevel: 21, maxLevel: 25 }, // Geodude
    { speciesId: 84, weight: 10, minLevel: 21, maxLevel: 25 }, // Doduo
    { speciesId: 77, weight: 8, minLevel: 22, maxLevel: 26 }, // Ponyta
    { speciesId: 22, weight: 8, minLevel: 22, maxLevel: 26 }, // Fearow
    { speciesId: 83, weight: 3, minLevel: 22, maxLevel: 26 }, // Farfetch'd (rare)
    { speciesId: 108, weight: 3, minLevel: 22, maxLevel: 26 }, // Lickitung (rare)
  ],
  // The ghost tower.
  spoktornet: [
    { speciesId: 92, weight: 40, minLevel: 20, maxLevel: 25 }, // Gastly
    { speciesId: 93, weight: 10, minLevel: 24, maxLevel: 27 }, // Haunter
    { speciesId: 96, weight: 18, minLevel: 21, maxLevel: 25 }, // Drowzee
    { speciesId: 104, weight: 14, minLevel: 21, maxLevel: 25 }, // Cubone
    { speciesId: 41, weight: 18, minLevel: 20, maxLevel: 24 }, // Zubat
  ],
  // Route 6: the forest around the lake.
  route6: [
    { speciesId: 102, weight: 16, minLevel: 23, maxLevel: 28 }, // Exeggcute
    { speciesId: 44, weight: 14, minLevel: 23, maxLevel: 28 }, // Gloom
    { speciesId: 70, weight: 14, minLevel: 23, maxLevel: 28 }, // Weepinbell
    { speciesId: 49, weight: 12, minLevel: 23, maxLevel: 28 }, // Venomoth
    { speciesId: 114, weight: 8, minLevel: 24, maxLevel: 28 }, // Tangela
    { speciesId: 54, weight: 12, minLevel: 23, maxLevel: 27 }, // Psyduck
    { speciesId: 123, weight: 4, minLevel: 24, maxLevel: 28 }, // Scyther (rare)
    { speciesId: 127, weight: 4, minLevel: 24, maxLevel: 28 }, // Pinsir (rare)
    { speciesId: 115, weight: 2, minLevel: 25, maxLevel: 29 }, // Kangaskhan (very rare)
  ],
  // The Wilderness: the rarest Pokémon of the world.
  vildmarken: [
    { speciesId: 113, weight: 8, minLevel: 28, maxLevel: 33 }, // Chansey
    { speciesId: 108, weight: 10, minLevel: 28, maxLevel: 33 }, // Lickitung
    { speciesId: 122, weight: 8, minLevel: 28, maxLevel: 33 }, // Mr. Mime
    { speciesId: 124, weight: 8, minLevel: 28, maxLevel: 33 }, // Jynx
    { speciesId: 126, weight: 8, minLevel: 28, maxLevel: 33 }, // Magmar
    { speciesId: 125, weight: 8, minLevel: 28, maxLevel: 33 }, // Electabuzz
    { speciesId: 132, weight: 8, minLevel: 26, maxLevel: 32 }, // Ditto
    { speciesId: 137, weight: 6, minLevel: 28, maxLevel: 33 }, // Porygon
    { speciesId: 128, weight: 8, minLevel: 28, maxLevel: 33 }, // Tauros
    { speciesId: 112, weight: 8, minLevel: 28, maxLevel: 33 }, // Rhydon
    { speciesId: 59, weight: 6, minLevel: 30, maxLevel: 34 }, // Arcanine
    { speciesId: 143, weight: 2, minLevel: 30, maxLevel: 34 }, // Snorlax (very rare)
    { speciesId: 142, weight: 2, minLevel: 30, maxLevel: 34 }, // Aerodactyl (very rare)
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
  // Route 6's lake.
  route6: {
    old: [{ speciesId: 129, weight: 1, minLevel: 8, maxLevel: 14 }],
    good: [
      { speciesId: 60, weight: 4, minLevel: 18, maxLevel: 24 }, // Poliwag
      { speciesId: 79, weight: 4, minLevel: 18, maxLevel: 24 }, // Slowpoke
      { speciesId: 118, weight: 4, minLevel: 18, maxLevel: 24 }, // Goldeen
      { speciesId: 54, weight: 3, minLevel: 18, maxLevel: 24 }, // Psyduck
    ],
    super: [
      { speciesId: 116, weight: 3, minLevel: 22, maxLevel: 28 }, // Horsea
      { speciesId: 90, weight: 3, minLevel: 22, maxLevel: 28 }, // Shellder
      { speciesId: 120, weight: 3, minLevel: 22, maxLevel: 28 }, // Staryu
      { speciesId: 119, weight: 3, minLevel: 24, maxLevel: 30 }, // Seaking
      { speciesId: 86, weight: 2, minLevel: 22, maxLevel: 28 }, // Seel
    ],
  },
  // The Wilderness lake: Dratini on the Super Rod.
  vildmarken: {
    old: [{ speciesId: 129, weight: 1, minLevel: 10, maxLevel: 16 }],
    good: [
      { speciesId: 79, weight: 4, minLevel: 24, maxLevel: 30 },
      { speciesId: 61, weight: 4, minLevel: 24, maxLevel: 30 },
      { speciesId: 119, weight: 3, minLevel: 24, maxLevel: 30 },
    ],
    super: [
      { speciesId: 147, weight: 4, minLevel: 26, maxLevel: 32 }, // Dratini
      { speciesId: 148, weight: 1, minLevel: 30, maxLevel: 34 }, // Dragonair (rare)
      { speciesId: 117, weight: 3, minLevel: 26, maxLevel: 32 }, // Seadra
      { speciesId: 121, weight: 2, minLevel: 28, maxLevel: 33 }, // Starmie
      { speciesId: 91, weight: 2, minLevel: 28, maxLevel: 33 }, // Cloyster
    ],
  },
}
