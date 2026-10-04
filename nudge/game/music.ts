// Which music belongs where (pure, so it can be tested).
import type { BattleKind } from '../engine/types'
import type { MusicId } from './audio-manifest'
import { getMap } from './maps'
import type { TrainerDef } from './types'

/** Battle music: wild Pokémon, ordinary trainers and gym leaders each have their own loop. */
export function battleMusic(kind: BattleKind, trainer?: Pick<TrainerDef, 'gym'> | null): MusicId {
  if (kind === 'wild') return 'battleWild'
  return trainer?.gym ? 'battleGym' : 'battleTrainer'
}

/** The loop for a map (null = silence). Unknown maps are silent instead of crashing. */
export function mapMusic(mapId: string): MusicId | null {
  try {
    return getMap(mapId).music ?? null
  } catch {
    return null
  }
}
