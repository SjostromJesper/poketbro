// The level brackets of the online matches (PLAN-4 2.2). Pure TypeScript, shared by the game and the Edge Functions.

/** '1-9', '10-19' ... '90-99' and '100'. */
export const BRACKET_IDS: string[] = [...Array.from({ length: 10 }, (_, i) => (i === 0 ? '1-9' : `${i * 10}-${i * 10 + 9}`)), '100']
/** Challenges can also use "free": no level limit. */
export const FREE_BRACKET = 'free'
export const TEAM_SIZE = 3

export interface LevelRange {
  min: number
  max: number
}

export function isRatedBracket(id: string): boolean {
  return BRACKET_IDS.includes(id)
}

export function isBracket(id: string): boolean {
  return isRatedBracket(id) || id === FREE_BRACKET
}

/** The levels a bracket allows (free: 1-100). Null for an unknown bracket. */
export function bracketRange(id: string): LevelRange | null {
  if (id === FREE_BRACKET) return { min: 1, max: 100 }
  if (!isRatedBracket(id)) return null
  if (id === '100') return { min: 100, max: 100 }
  const [min, max] = id.split('-').map(Number)
  return { min, max }
}

export function fitsBracket(level: number, id: string): boolean {
  const range = bracketRange(id)
  return !!range && Number.isInteger(level) && level >= range.min && level <= range.max
}

/** The bracket a level belongs to. */
export function bracketOfLevel(level: number): string {
  if (level >= 100) return '100'
  if (level < 10) return '1-9'
  return `${Math.floor(level / 10) * 10}-${Math.floor(level / 10) * 10 + 9}`
}

/** Label for menus: "Nivå 20-29", "Nivå 100", "Fri". */
export function bracketLabel(id: string): string {
  if (id === FREE_BRACKET) return 'Fri (ingen nivågräns)'
  return id === '100' ? 'Nivå 100' : `Nivå ${id}`
}
