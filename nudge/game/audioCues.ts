// Which sound goes with which battle event (pure, so it can be tested). The audio store plays the cues.
import type { BattleEvent, Side } from '../engine/types'
import type { SfxId } from './audio-manifest'

export type Cue =
  | { type: 'sfx', id: SfxId, delayMs?: number }
  /** A cry of the Pokémon that is active on `side` (or `speciesId` when known). `rate` < 1 is lower in pitch. */
  | { type: 'cry', side: Side, speciesId?: number, rate?: number, delayMs?: number }

export function cuesForEvent(event: BattleEvent): Cue[] {
  switch (event.type) {
    case 'send-out':
      return [{ type: 'cry', side: event.side, speciesId: event.speciesId }]
    case 'move-chosen':
      if (event.followedNudge === true) return [{ type: 'sfx', id: 'nudgeFollowed' }]
      if (event.followedNudge === false) return [{ type: 'sfx', id: 'nudgeIgnored' }]
      return []
    case 'damage': {
      if (event.source === 'status' || event.source === 'leech-seed' || event.amount <= 0) return []
      if (event.crit) return [{ type: 'sfx', id: 'hitCrit' }]
      if (event.effectiveness > 1) return [{ type: 'sfx', id: 'hitSuper' }]
      if (event.effectiveness < 1) return [{ type: 'sfx', id: 'hitWeak' }]
      return [{ type: 'sfx', id: 'hitNormal' }]
    }
    case 'miss':
      return [{ type: 'sfx', id: 'miss' }]
    case 'no-effect':
      return [{ type: 'sfx', id: 'noEffect' }]
    case 'faint':
      // The cry comes down in pitch, after the thud.
      return [{ type: 'sfx', id: 'faint' }, { type: 'cry', side: event.side, speciesId: event.speciesId, rate: 0.7, delayMs: 150 }]
    case 'heal':
      return event.source === 'leftovers' || event.source === 'leech-seed' ? [] : [{ type: 'sfx', id: 'heal' }]
    case 'item-used':
      return [{ type: 'sfx', id: 'itemUse' }]
    case 'status':
      return event.status === 'protect' ? [{ type: 'sfx', id: 'statUp' }] : [{ type: 'sfx', id: 'status' }]
    case 'stat-change':
      return [{ type: 'sfx', id: event.delta > 0 ? 'statUp' : 'statDown' }]
    case 'nudge':
      return event.result === 'accepted' || event.result === 'replaced' ? [{ type: 'sfx', id: 'nudgeClick' }]
        : event.result === 'exhausted' ? [{ type: 'sfx', id: 'nudgeIgnored' }] : []
    case 'run':
      return event.success ? [{ type: 'sfx', id: 'runAway' }] : []
    default:
      return []
  }
}
