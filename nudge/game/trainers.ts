// The registry of trainer definitions. Trainers are defined next to where they stand (see trainerClasses.ts and the map files); this module
// only holds them, so everything else can look a trainer up by id.
import type { TrainerDef } from './types'

export const TRAINERS: Record<string, TrainerDef> = {}

/** Adds a trainer defined elsewhere. Defining the same id twice is a mistake (two trainers would share a name tag). */
export function registerTrainer(def: TrainerDef): TrainerDef {
  if (TRAINERS[def.id] && TRAINERS[def.id] !== def) throw new Error(`Trainer ${def.id} is defined twice`)
  TRAINERS[def.id] = def
  return def
}
