// Swedish battle log text for BattleEvents. Returns null for events that should not appear in the log.
import type { BattleStatKey, GameData } from '../data/types'
import type { BattleEvent, BattleKind } from './types'

const STAT_LABELS: Record<BattleStatKey, string> = {
  attack: 'Attack',
  defense: 'Försvar',
  spAttack: 'Spec.attack',
  spDefense: 'Spec.försvar',
  speed: 'Snabbhet',
  accuracy: 'Träffsäkerhet',
  evasion: 'Undvikande',
}

const CHARGE_TEXT: Record<string, string> = {
  'solar-beam': 'samlar ljus',
  'skull-bash': 'gömmer huvudet',
  'sky-attack': 'börjar glöda',
  'razor-wind': 'skapar en virvelvind',
  'fly': 'flyger upp i skyn',
  'dig': 'gräver sig ner',
  'bounce': 'studsar upp i luften',
  'dive': 'dyker ner under ytan',
}

export interface MessageContext {
  kind?: BattleKind
  data?: GameData
}

/** "Vilda Rattata" / "Motståndarens Onix" for the enemy side, the plain name for the player's own Pokémon. */
function who(event: { side: 'player' | 'enemy', name: string }, ctx: MessageContext): string {
  if (event.side === 'player') return event.name
  return ctx.kind === 'trainer' ? `Motståndarens ${event.name}` : `Vilda ${event.name}`
}

export function describeEvent(event: BattleEvent, ctx: MessageContext = {}): string | null {
  switch (event.type) {
    case 'send-out':
      if (event.side === 'player') return `Kom igen, ${event.name}!`
      return ctx.kind === 'trainer' ? `Motståndaren skickade ut ${event.name}!` : `En vild ${event.name} dök upp!`
    case 'move-used':
      return `${who(event, ctx)} använde ${event.moveName}!`
    case 'charge-start': {
      const text = CHARGE_TEXT[event.move] ?? 'laddar upp'
      return `${who(event, ctx)} ${text}...`
    }
    case 'miss':
      return `${who(event, ctx)}s attack missade!`
    case 'no-effect':
      switch (event.reason) {
        case 'immune': return `Det påverkar inte ${who(event, ctx)}...`
        case 'protected': return `${who(event, ctx)} skyddade sig!`
        case 'unaffected': return `Det hade ingen effekt på ${who(event, ctx)}.`
        case 'inert': return 'Men inget hände...'
        default: return 'Men det misslyckades!'
      }
    case 'unsupported':
      return 'Men inget hände...'
    case 'damage': {
      if (event.source === 'status' || event.source === 'leech-seed') return null
      if (event.source === 'confusion') return null
      if (event.source === 'recoil') return `${who(event, ctx)} skadades av rekylen!`
      const parts: string[] = []
      if (event.crit) parts.push('Kritisk träff!')
      if (event.effectiveness > 1) parts.push('Det var supereffektivt!')
      else if (event.effectiveness < 1 && event.effectiveness > 0) parts.push('Det var inte särskilt effektivt...')
      return parts.length ? parts.join(' ') : null
    }
    case 'multi-hit':
      return `Träffade ${event.hits} gånger!`
    case 'heal':
      if (event.source === 'leftovers' || event.source === 'leech-seed') return null
      if (event.source === 'drain') return `${who(event, ctx)} sög åt sig ${event.amount} HP!`
      return `${who(event, ctx)} återfick ${event.amount} HP.`
    case 'status':
      switch (event.status) {
        case 'burn': return `${who(event, ctx)} fick en brännskada!`
        case 'poison': return `${who(event, ctx)} blev förgiftad!`
        case 'paralysis': return `${who(event, ctx)} blev förlamad!`
        case 'sleep': return `${who(event, ctx)} somnade!`
        case 'freeze': return `${who(event, ctx)} frös till is!`
        case 'confusion': return `${who(event, ctx)} blev förvirrad!`
        case 'leech-seed': return `${who(event, ctx)} blev sådd!`
        case 'protect': return `${who(event, ctx)} skyddar sig!`
      }
      return null
    case 'status-cured':
      switch (event.reason) {
        case 'wake': return `${who(event, ctx)} vaknade!`
        case 'thaw': return `${who(event, ctx)} tinade!`
        case 'item': return `${who(event, ctx)} blev frisk!`
        default: return `${who(event, ctx)} är inte längre ${event.status === 'confusion' ? 'förvirrad' : 'sjuk'}.`
      }
    case 'status-skip':
      return event.reason === 'paralysis'
        ? `${who(event, ctx)} är förlamad och kan inte röra sig!`
        : `${who(event, ctx)} skadade sig själv i sin förvirring!`
    case 'stat-change': {
      const label = STAT_LABELS[event.stat]
      if (event.delta === 0) return `${who(event, ctx)}s ${label} kan inte gå ${event.stage > 0 ? 'högre' : 'lägre'}!`
      const strength = Math.abs(event.delta) >= 2 ? (event.delta > 0 ? ' kraftigt' : ' kraftigt') : ''
      return `${who(event, ctx)}s ${label} ${event.delta > 0 ? 'ökade' : 'minskade'}${strength}!`
    }
    case 'flinch':
      return `${who(event, ctx)} ryggade tillbaka!`
    case 'faint':
      return `${who(event, ctx)} svimmade!`
    case 'endure':
      return `${who(event, ctx)} bet ihop och klarade sig med 1 HP!`
    case 'disobey':
      if (event.outcome === 'loaf') return `${who(event, ctx)} slöar och lyssnar inte!`
      if (event.outcome === 'nap') return `${who(event, ctx)} somnar en stund!`
      return `${who(event, ctx)} gör som den själv vill!`
    case 'held-item': {
      const itemName = ctx.data?.items[event.item]?.displayName ?? event.item
      return `${who(event, ctx)}s ${itemName} aktiverades!`
    }
    case 'item-used': {
      const itemName = ctx.data?.items[event.item]?.displayName ?? event.item
      return `Du använde ${itemName} på ${event.name}.`
    }
    case 'switch':
      return `${event.fromName}, kom tillbaka!`
    case 'ball-throw':
      if (event.caught) return `Fångad! ${event.name} är din!`
      if (event.shakes >= 2) return 'Åh nej! Så nära! Den kom loss.'
      if (event.shakes === 1) return 'Den kom loss!'
      return 'Bollen missade nästan helt, den kom loss direkt.'
    case 'run':
      return event.success ? 'Du kom undan!' : 'Du kunde inte fly!'
    case 'effect':
      switch (event.effect) {
        case 'focus-energy': return `${who(event, ctx)} spänner sig!`
        case 'haze': return 'Alla stat-ändringar försvann!'
        case 'rest': return `${who(event, ctx)} somnade och blev frisk!`
        case 'belly-drum': return `${who(event, ctx)} offrade HP och maxade sin Attack!`
      }
      return null
    case 'battle-end':
      if (event.result === 'win') return 'Du vann striden!'
      if (event.result === 'lose') return 'Du har inga Pokémon kvar som kan slåss...'
      return null
    default:
      return null
  }
}
