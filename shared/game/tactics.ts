export type PrimaryTactic = 'normal' | 'offensive' | 'defensive' | 'berserk'
export type SecondaryTactic = 'normal' | 'heavy' | 'light'

export interface TacticOption {
  id: string
  label: string
  primary: PrimaryTactic
  secondary: SecondaryTactic
  description: string
}

export const TACTICS: TacticOption[] = [
  {
    id: 'normal',
    label: 'Normal',
    primary: 'normal',
    secondary: 'normal',
    description: 'Ingen påverkan alls - standardinställningarna används.',
  },
  {
    id: 'offensive',
    label: 'Offensiv',
    primary: 'offensive',
    secondary: 'normal',
    description: 'Ökar initiativ, men minskar din undvikning.',
  },
  {
    id: 'offensive-light',
    label: 'Offensiv - lätta attacker',
    primary: 'offensive',
    secondary: 'light',
    description: 'Ökar initiativ och träffsäkerhet, men minskar skada och undvikning.',
  },
  {
    id: 'offensive-heavy',
    label: 'Offensiv - tunga attacker',
    primary: 'offensive',
    secondary: 'heavy',
    description: 'Ökar initiativ och skada rejält, men träffsäkerhet och undvikning blir sämre.',
  },
  {
    id: 'defensive',
    label: 'Defensiv',
    primary: 'defensive',
    secondary: 'normal',
    description: 'Ökar din undvikning, men minskar initiativ.',
  },
  {
    id: 'defensive-light',
    label: 'Defensiv - lätta attacker',
    primary: 'defensive',
    secondary: 'light',
    description: 'Hög undvikning och träffsäkerhet, men låg skada och initiativ.',
  },
  {
    id: 'defensive-heavy',
    label: 'Defensiv - tunga attacker',
    primary: 'defensive',
    secondary: 'heavy',
    description: 'Hög undvikning och skada, men sämre träffsäkerhet och initiativ.',
  },
  {
    id: 'berserk',
    label: 'Berserk',
    primary: 'berserk',
    secondary: 'normal',
    description: 'Kraftigt ökat initiativ, men mycket sämre undvikning och du tar 5% mer skada.',
  },
  {
    id: 'berserk-light',
    label: 'Berserk - lätta attacker',
    primary: 'berserk',
    secondary: 'light',
    description: 'Extremt högt initiativ och bra träffsäkerhet, men lätt skada, svag undvikning och 5% mer skada tagen.',
  },
  {
    id: 'berserk-heavy',
    label: 'Berserk - tunga attacker',
    primary: 'berserk',
    secondary: 'heavy',
    description: 'Extremt högt initiativ och hög skada, men du träffar sällan, undviker nästan aldrig och tar 5% mer skada.',
  },
]

export function tacticById(id: string): TacticOption {
  const tactic = TACTICS.find(t => t.id === id)
  if (!tactic) throw new Error(`Unknown tactic id: ${id}`)
  return tactic
}

export interface TacticModifiers {
  initiativeMult: number
  evasionMult: number
  accuracyMult: number
  damageMult: number
  damageTakenMult: number
}

export function tacticModifiers(tactic: TacticOption): TacticModifiers {
  const mods: TacticModifiers = {
    initiativeMult: 1,
    evasionMult: 1,
    accuracyMult: 1,
    damageMult: 1,
    damageTakenMult: 1,
  }

  switch (tactic.primary) {
    case 'offensive':
      mods.initiativeMult *= 1.15
      mods.evasionMult *= 0.85
      break
    case 'defensive':
      mods.initiativeMult *= 0.85
      mods.evasionMult *= 1.15
      break
    case 'berserk':
      mods.initiativeMult *= 1.25
      mods.evasionMult *= 0.7
      mods.accuracyMult *= 0.9
      mods.damageTakenMult *= 1.05
      break
  }

  switch (tactic.secondary) {
    case 'heavy':
      mods.damageMult *= 1.2
      mods.accuracyMult *= 0.85
      mods.initiativeMult *= 0.95
      break
    case 'light':
      mods.damageMult *= 0.8
      mods.accuracyMult *= 1.15
      mods.initiativeMult *= 1.05
      break
  }

  return mods
}
