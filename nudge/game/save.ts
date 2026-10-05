// Save data format, validation and a summary for the title screen. Pure TypeScript (storage itself is the UI layer's job).
import { gameData } from '../data'
import type { OwnedPokemon } from '../engine/types'
import { MAPS, START_MAP } from './maps'
import { migrateSave } from './saveSlots'
import type { WorldState } from './types'

export const SAVE_VERSION = 2
/** The key of the single-slot save of earlier versions; it is migrated into slot 1 on first start. */
export const SAVE_KEY = 'nudge:save:v1'

/** Mirrors `PlayerSave` in the player store (kept here so this module has no Vue dependency). */
export interface PlayerData {
  name: string
  party: OwnedPokemon[]
  box: OwnedPokemon[]
  money: number
  bag: Record<string, number>
  badges: string[]
  pokedex: number[]
  stepRemainder: number
  /** Approximate time played (ms). */
  playTimeMs: number
}

export interface SaveData {
  version: number
  savedAt: number
  player: PlayerData
  world: WorldState
}

export type ParseResult =
  | { ok: true, save: SaveData }
  | { ok: false, reason: 'missing' | 'corrupt' | 'version' }

export function serializeSave(player: PlayerData, world: WorldState, now = Date.now()): string {
  const save: SaveData = { version: SAVE_VERSION, savedAt: now, player, world }
  return JSON.stringify(save)
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function validPokemon(p: unknown): p is OwnedPokemon {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.uid === 'string'
    && isNumber(o.speciesId) && !!gameData.species[o.speciesId as number]
    && isNumber(o.level) && isNumber(o.xp) && isNumber(o.trust) && isNumber(o.currentHp)
    && typeof o.nature === 'string' && !!gameData.natures[o.nature]
    && typeof o.trait === 'string'
    && Array.isArray(o.moves) && o.moves.every((m: unknown) => {
      const mv = m as Record<string, unknown>
      return typeof mv?.move === 'string' && !!gameData.moves[mv.move] && isNumber(mv.pp) && isNumber(mv.maxPp)
    })
    && !!o.ivs && typeof o.ivs === 'object'
    && !!o.habits && typeof o.habits === 'object'
}

export function parseSave(raw: string | null): ParseResult {
  if (!raw) return { ok: false, reason: 'missing' }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'corrupt' }
  // Older saves are upgraded step by step; saves from a newer game version are refused.
  const migrated = migrateSave(data, SAVE_VERSION)
  if (!migrated) return { ok: false, reason: typeof (data as { version?: unknown }).version === 'number' ? 'version' : 'corrupt' }
  const d = migrated as Partial<SaveData>
  const { player, world } = d
  if (!player || !world || !isNumber(d.savedAt)) return { ok: false, reason: 'corrupt' }
  const okPlayer = typeof player.name === 'string'
    && Array.isArray(player.party) && player.party.every(validPokemon)
    && Array.isArray(player.box) && player.box.every(validPokemon)
    && isNumber(player.money)
    && !!player.bag && typeof player.bag === 'object'
    && Array.isArray(player.badges) && Array.isArray(player.pokedex) && isNumber(player.stepRemainder) && isNumber(player.playTimeMs)
  const okWorld = typeof world.mapId === 'string' && isNumber(world.x) && isNumber(world.y)
    && Array.isArray(world.flags) && Array.isArray(world.defeatedTrainers) && isNumber(world.steps)
    && !!world.lastCenter && typeof world.lastCenter.mapId === 'string'
  if (!okPlayer || !okWorld) return { ok: false, reason: 'corrupt' }

  // A save that points at an unknown map or a blocked tile falls back to the start of the game.
  const map = MAPS[world.mapId]
  const tile = map?.tiles[world.y]?.[world.x]
  if (!map || tile === undefined || tile === '#' || tile === '~') {
    d.world = { ...world, mapId: START_MAP.mapId, x: START_MAP.x, y: START_MAP.y, facing: 'down' }
  }
  if (!MAPS[d.world!.lastCenter.mapId]) d.world!.lastCenter = { mapId: START_MAP.mapId, x: START_MAP.x, y: START_MAP.y }
  return { ok: true, save: d as SaveData }
}

export interface SaveSummary {
  playerName: string
  /** Species ids of the party, for the little icons in the load menu. */
  partyIcons: number[]
  playTimeMs: number
  leadName: string | null
  leadSpeciesId: number | null
  leadLevel: number | null
  partySize: number
  badges: number
  money: number
  placeName: string
  savedAt: number
}

export function summarizeSave(save: SaveData): SaveSummary {
  const lead = save.player.party[0]
  const species = lead ? gameData.species[lead.speciesId] : null
  return {
    playerName: save.player.name,
    partyIcons: save.player.party.slice(0, 6).map(p => p.speciesId),
    playTimeMs: save.player.playTimeMs,
    leadName: lead ? (lead.nickname?.trim() || species!.displayName) : null,
    leadSpeciesId: lead?.speciesId ?? null,
    leadLevel: lead?.level ?? null,
    partySize: save.player.party.length,
    badges: save.player.badges.length,
    money: save.player.money,
    placeName: MAPS[save.world.mapId]?.name ?? '?',
    savedAt: save.savedAt,
  }
}
