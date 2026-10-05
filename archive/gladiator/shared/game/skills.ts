export const SKILL_SLOT_COUNT = 4

export type SkillTriggerCondition = 'always' | 'on_hit' | 'on_evade' | 'on_block' | 'on_critical'
export type SkillEffectType = 'bonus_damage' | 'heal_self' | 'extra_attack'

export interface SkillDefinition {
  id: string
  name: string
  description: string
  /** 0-1 chance to trigger when its condition is met. */
  triggerChance: number
  triggerCondition: SkillTriggerCondition
  /** null = unlimited triggers per battle. */
  maxTriggers: number | null
  effect: SkillEffectType
  /** Meaning depends on effect: bonus_damage = flat extra damage, heal_self = fraction of max HP, extra_attack = unused. */
  effectValue: number
}

export const CONDITION_LABELS: Record<SkillTriggerCondition, string> = {
  always: 'varje runda',
  on_hit: 'vid träff',
  on_evade: 'vid undvikande',
  on_block: 'vid blockering',
  on_critical: 'vid kritisk träff',
}

export const COMMON_SKILLS: SkillDefinition[] = [
  {
    id: 'fast_reflexes',
    name: 'Snabba reflexer',
    description: 'Chans att kontra direkt när du undviker en fiendes attack.',
    triggerChance: 0.15,
    triggerCondition: 'on_evade',
    maxTriggers: null,
    effect: 'extra_attack',
    effectValue: 0,
  },
  {
    id: 'iron_skin',
    name: 'Järnhud',
    description: 'Läker en liten mängd liv varje gång du blockerar en attack.',
    triggerChance: 0.4,
    triggerCondition: 'on_block',
    maxTriggers: 3,
    effect: 'heal_self',
    effectValue: 0.05,
  },
  {
    id: 'berserker_fury',
    name: 'Berserkarraseri',
    description: 'Chans att slå extra hårt varje gång du träffar.',
    triggerChance: 0.2,
    triggerCondition: 'on_hit',
    maxTriggers: null,
    effect: 'bonus_damage',
    effectValue: 8,
  },
  {
    id: 'killer_instinct',
    name: 'Mördarinstinkt',
    description: 'Chans att fortsätta anfalla direkt efter en kritisk träff.',
    triggerChance: 0.5,
    triggerCondition: 'on_critical',
    maxTriggers: 1,
    effect: 'extra_attack',
    effectValue: 0,
  },
  {
    id: 'second_wind',
    name: 'Ny fläkt',
    description: 'Chans att läka lite liv i varje runda, oavsett hur den gick.',
    triggerChance: 0.1,
    triggerCondition: 'always',
    maxTriggers: 3,
    effect: 'heal_self',
    effectValue: 0.08,
  },
]

export function skillById(id: string): SkillDefinition | undefined {
  return COMMON_SKILLS.find(s => s.id === id)
}

export type SkillSlots = (string | null)[]

export function emptySkillSlots(): SkillSlots {
  return Array.from({ length: SKILL_SLOT_COUNT }, () => null)
}

export function resolveSkills(skillIds: SkillSlots | null | undefined): SkillDefinition[] {
  if (!skillIds) return []
  return skillIds
    .filter((id): id is string => Boolean(id))
    .map(id => skillById(id))
    .filter((s): s is SkillDefinition => Boolean(s))
}

export function triggerSummary(skill: SkillDefinition): string {
  const chance = Math.round(skill.triggerChance * 100)
  const limit = skill.maxTriggers === null ? 'obegränsat' : `max ${skill.maxTriggers} gång${skill.maxTriggers === 1 ? '' : 'er'}/strid`
  return `${chance}% chans ${CONDITION_LABELS[skill.triggerCondition]} · ${limit}`
}
