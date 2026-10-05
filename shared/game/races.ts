export interface StatBlock {
  strength: number
  endurance: number
  health: number
  initiative: number
  evasion: number
  swordSkill: number
  axeSkill: number
  thrustSkill: number
  hammerSkill: number
  chainSkill: number
  shieldSkill: number
}

export const STAT_KEYS: (keyof StatBlock)[] = [
  'strength',
  'endurance',
  'health',
  'initiative',
  'evasion',
  'swordSkill',
  'axeSkill',
  'thrustSkill',
  'hammerSkill',
  'chainSkill',
  'shieldSkill',
]

export const STAT_LABELS: Record<keyof StatBlock, string> = {
  strength: 'Styrka',
  endurance: 'Uthållighet',
  health: 'Hälsa',
  initiative: 'Initiativ',
  evasion: 'Undvikning',
  swordSkill: 'Svärd',
  axeSkill: 'Yxa',
  thrustSkill: 'Stick',
  hammerSkill: 'Hammare',
  chainSkill: 'Kätting',
  shieldSkill: 'Sköld',
}

/** The five weapon-proficiency stats, as opposed to the general combat stats. */
export const WEAPON_SKILL_KEYS: (keyof StatBlock)[] = ['swordSkill', 'axeSkill', 'thrustSkill', 'hammerSkill', 'chainSkill']
export const GENERAL_STAT_KEYS: (keyof StatBlock)[] = ['strength', 'endurance', 'health', 'initiative', 'evasion']

export const BASE_POINT_POOL = 150

export function emptyStats(): StatBlock {
  return {
    strength: 0,
    endurance: 0,
    health: 0,
    initiative: 0,
    evasion: 0,
    swordSkill: 0,
    axeSkill: 0,
    thrustSkill: 0,
    hammerSkill: 0,
    chainSkill: 0,
    shieldSkill: 0,
  }
}

export interface Race {
  id: string
  name: string
  description: string
  /**
   * Percentage modifiers, not flat additions - e.g. 10 means the allocated points in that
   * stat come out 10% higher, -15 means 15% lower. Matches how real Lanista races work
   * (checked against wiki.lanista.se): Människa/Alv/Dvärg below use the real percentages;
   * Ork/Troll/Skuggfödd have no real-game equivalent so their numbers are invented in the
   * same style/magnitude, not sourced from anywhere.
   */
  modifiers: StatBlock
}

/** Applies the same percentage modifier to all weapon skills plus shield skill - races are broadly better/worse at arms, not type-specific. */
function weaponModifiers(value: number): Pick<StatBlock, 'swordSkill' | 'axeSkill' | 'thrustSkill' | 'hammerSkill' | 'chainSkill' | 'shieldSkill'> {
  return { swordSkill: value, axeSkill: value, thrustSkill: value, hammerSkill: value, chainSkill: value, shieldSkill: value }
}

export const RACES: Race[] = [
  {
    id: 'human',
    name: 'Människa',
    description: 'Ingen ras-specialisering, men en mild fördel över hela linjen och inga svagheter.',
    modifiers: { strength: 8, endurance: 8, health: 8, initiative: 8, evasion: 8, ...weaponModifiers(10) },
  },
  {
    id: 'orc',
    name: 'Ork',
    description: 'Ren råstyrka och tjock hud. Långsam och lätt att träffa, men slår brutalt hårt.',
    modifiers: { strength: 20, endurance: 10, health: 15, initiative: -20, evasion: -25, swordSkill: 0, axeSkill: 10, thrustSkill: -10, hammerSkill: 15, chainSkill: 0, shieldSkill: -10 },
  },
  {
    id: 'elf',
    name: 'Alv',
    description: 'Snabb och svårfångad, men en skör kropp som inte tål lika mycket stryk.',
    modifiers: { strength: -10, endurance: 30, health: -10, initiative: 25, evasion: 55, swordSkill: 20, axeSkill: 5, thrustSkill: 25, hammerSkill: 5, chainSkill: 10, shieldSkill: 25 },
  },
  {
    id: 'dwarf',
    name: 'Dvärg',
    description: 'Stålbenta uthållighetskämpar. Sega som stenar men inte de kvickaste på foten.',
    modifiers: { strength: 15, endurance: -15, health: 30, initiative: -15, evasion: -40, swordSkill: 0, axeSkill: 20, thrustSkill: 0, hammerSkill: 20, chainSkill: 0, shieldSkill: 10 },
  },
  {
    id: 'troll',
    name: 'Troll',
    description: 'Enorm råstyrka och uthållighet i en kropp som varken träffar säkert eller undviker något.',
    modifiers: { strength: 35, endurance: 25, health: 10, initiative: -20, evasion: -45, swordSkill: -10, axeSkill: -10, thrustSkill: -15, hammerSkill: -5, chainSkill: -10, shieldSkill: -15 },
  },
  {
    id: 'shadowborn',
    name: 'Skuggfödd',
    description: 'Född i skuggorna mellan arenans pelare. Dödligt precis och svårfångad, men bräcklig.',
    modifiers: { strength: -15, endurance: -10, health: -25, initiative: 15, evasion: 35, swordSkill: 20, axeSkill: 15, thrustSkill: 25, hammerSkill: 5, chainSkill: 15, shieldSkill: -10 },
  },
]

/**
 * Used for procedurally generated opponents (training dummies, test bots). Spreads points
 * across the five general stats plus ONE randomly chosen weapon skill, so generated opponents
 * look like a specialized fighter rather than a jack-of-all-weapons with no real proficiency.
 */
export function randomAllocation(pool: number): StatBlock {
  const primaryWeapon = WEAPON_SKILL_KEYS[Math.floor(Math.random() * WEAPON_SKILL_KEYS.length)]
  const activeKeys: (keyof StatBlock)[] = [...GENERAL_STAT_KEYS, primaryWeapon]

  const weights = activeKeys.map(() => Math.random())
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  const result = emptyStats()
  let assigned = 0
  activeKeys.forEach((key, index) => {
    const isLast = index === activeKeys.length - 1
    const value = isLast ? pool - assigned : Math.round((weights[index] / totalWeight) * pool)
    result[key] = value
    assigned += value
  })
  return result
}

export function raceById(id: string): Race {
  const race = RACES.find(r => r.id === id)
  if (!race) throw new Error(`Unknown race id: ${id}`)
  return race
}

/**
 * Race modifiers are percentages applied to the points you allocate, not flat additions -
 * every race shares the same BASE_POINT_POOL. Allocating into a stat your race is good at
 * is rewarded proportionally; allocating into one it's bad at is punished the same way.
 */
export function finalStats(race: Race, allocated: StatBlock): StatBlock {
  const result = emptyStats()
  for (const key of STAT_KEYS) {
    const percent = race.modifiers[key] ?? 0
    result[key] = Math.round((allocated[key] ?? 0) * (1 + percent / 100))
  }
  return result
}
