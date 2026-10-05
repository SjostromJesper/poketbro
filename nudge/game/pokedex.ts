// Pokédex helpers (pure): where each species can be found, which species the game can give the player at all, and the entries of the list.
import type { GameData } from '../data/types'
import { ENCOUNTER_TABLES, FISHING_TABLES, type Rod } from './encounters'
import { STARTERS } from './items'
import { MAPS } from './maps'

export const ROD_LABELS: Record<Rod, string> = { old: 'Gammalt spö', good: 'Bra spö', super: 'Superspö' }

export type Source =
  | { kind: 'grass', map: string, mapName: string, cave: boolean }
  | { kind: 'fishing', map: string, mapName: string, rod: Rod }
  | { kind: 'gift', map: string, mapName: string, from: string }
  | { kind: 'evolution', from: number, how: string }

/** Everything the game gives the player directly (not through evolution): wild encounters, fishing and gifts. */
export function directSources(): Map<number, Source[]> {
  const out = new Map<number, Source[]>()
  const add = (id: number, source: Source) => out.set(id, [...(out.get(id) ?? []), source])
  for (const starter of STARTERS) add(starter.speciesId, { kind: 'gift', map: 'proflab', mapName: 'Professorns labb', from: 'Professor Almqvist' })
  for (const map of Object.values(MAPS)) {
    if (map.encounterTable) {
      const cave = map.tiles.some(row => row.includes('c'))
      for (const e of ENCOUNTER_TABLES[map.encounterTable] ?? []) add(e.speciesId, { kind: 'grass', map: map.id, mapName: map.name, cave })
    }
    const fishId = map.fishingTable ?? map.encounterTable
    for (const rod of ['old', 'good', 'super'] as Rod[]) {
      for (const e of (fishId ? FISHING_TABLES[fishId]?.[rod] : undefined) ?? []) add(e.speciesId, { kind: 'fishing', map: map.id, mapName: map.name, rod })
    }
    for (const npc of map.npcs) {
      for (const p of npc.give?.pokemon ?? []) add(p.speciesId, { kind: 'gift', map: map.id, mapName: map.name, from: npc.name ?? 'en person' })
    }
  }
  return out
}

/** The same sources plus evolution: a species you can reach by evolving something you can get counts as obtainable. */
export function obtainable(data: GameData): Map<number, Source[]> {
  const sources = directSources()
  let grew = true
  while (grew) {
    grew = false
    for (const species of Object.values(data.species)) {
      if (!sources.has(species.id)) continue
      for (const evo of species.evolutions) {
        if (!data.species[evo.to] || sources.has(evo.to)) continue
        const how = evo.item ? `med ${data.items[evo.item]?.displayName ?? evo.item}` : evo.trade ? 'vid hög nivå' : `på nivå ${evo.minLevel}`
        sources.set(evo.to, [{ kind: 'evolution', from: species.id, how }])
        grew = true
      }
    }
  }
  return sources
}

/** Swedish lines for the "where can I find it" part of an entry. */
export function describeSources(data: GameData, sources: Source[]): string[] {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const s of sources) {
    const line = s.kind === 'grass' ? `${s.mapName} (${s.cave ? 'grottan' : 'högt gräs'})`
      : s.kind === 'fishing' ? `${s.mapName} (fiske, ${ROD_LABELS[s.rod]})`
        : s.kind === 'gift' ? `Gåva i ${s.mapName}`
          : `Utvecklas från ${data.species[s.from].displayName} ${s.how}`
    if (!seen.has(line)) {
      seen.add(line)
      lines.push(line)
    }
  }
  return lines
}

