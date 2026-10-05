import type { StatBlock } from '#shared/game/races'

export interface Character {
  id: string
  user_id: string
  name: string
  race_id: string
  allocated: StatBlock
  level: number
  xp: number
  current_hp: number
  last_regen_at: number
  default_tactic_id: string
  default_give_up_percent: number
  skill_ids: (string | null)[]
  unspent_points: number
  gold: number
  time_remaining: number
  last_time_regen_at: number
  stats: StatBlock
  maxHp: number
}

export function useCharacter() {
  const character = useState<Character | null>('character', () => null)
  const loaded = useState('characterLoaded', () => false)

  async function load(force = false) {
    if (loaded.value && !force) return
    try {
      const data = await $fetch('/api/characters/me')
      character.value = data as Character | null
    } catch {
      character.value = null
    }
    loaded.value = true
  }

  async function create(payload: { name: string, raceId: string, allocated: StatBlock, skillId: string }) {
    await $fetch('/api/characters/create', { method: 'POST', body: payload })
    await load(true)
  }

  function setCharacter(data: Character) {
    character.value = data
    loaded.value = true
  }

  function reset() {
    character.value = null
    loaded.value = false
  }

  return { character, load, create, setCharacter, reset }
}
