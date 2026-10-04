// Build-time data fetch from PokeAPI. Run with `npm run fetch-data`.
// The game itself never calls PokeAPI at runtime: this script normalises everything into compact JSON in nudge/data/.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TYPE_NAMES,
  type BattleStatKey,
  type DamageClass,
  type GrowthRates,
  type ItemData,
  type MoveData,
  type NatureData,
  type SpeciesData,
  type StatBlock,
  type StatKey,
  type TypeChart,
  type TypeName,
} from '../data/types'

const API = 'https://pokeapi.co/api/v2'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE_DIR = join(ROOT, '.cache', 'pokeapi')
const OUT_DIR = join(ROOT, 'nudge', 'data')
const MAX_POKEMON = 151
const VERSION_GROUP = 'firered-leafgreen'
const CONCURRENCY = 5

/** Items used by the game (held items, consumables, balls). Missing ones are skipped with a warning. */
const ITEM_NAMES = [
  'poke-ball', 'great-ball', 'ultra-ball', 'potion', 'antidote', 'paralyze-heal', 'oran-berry',
  'quick-claw', 'silk-scarf', 'charcoal', 'mystic-water', 'leftovers',
]

const STAT_MAP: Record<string, StatKey> = {
  'hp': 'hp',
  'attack': 'attack',
  'defense': 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  'speed': 'speed',
}
const BATTLE_STAT_MAP: Record<string, BattleStatKey> = {
  'attack': 'attack',
  'defense': 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  'speed': 'speed',
  'accuracy': 'accuracy',
  'evasion': 'evasion',
}

// ---------------------------------------------------------------------------
// HTTP with cache, retry and a small concurrency pool
// ---------------------------------------------------------------------------

let requestsMade = 0
let cacheHits = 0

async function get<T = any>(path: string): Promise<T> {
  const cacheFile = join(CACHE_DIR, `${path.replace(/^\//, '').replace(/[/?=&]/g, '__')}.json`)
  try {
    const cached = await readFile(cacheFile, 'utf8')
    cacheHits++
    return JSON.parse(cached) as T
  } catch {
    // not cached yet
  }
  let lastError: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      requestsMade++
      const res = await fetch(`${API}${path}`)
      if (res.status === 404) throw new NotFoundError(path)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
      const text = await res.text()
      await mkdir(dirname(cacheFile), { recursive: true })
      await writeFile(cacheFile, text)
      return JSON.parse(text) as T
    } catch (error) {
      if (error instanceof NotFoundError) throw error
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
  throw lastError
}

class NotFoundError extends Error {
  constructor(path: string) {
    super(`404 for ${path}`)
  }
}

async function mapPool<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run))
  return results
}

function idFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/)
  if (!match) throw new Error(`Cannot parse id from ${url}`)
  return Number(match[1])
}

function pickName(names: { language: { name: string }, name: string }[], fallback: string): string {
  return names.find(n => n.language.name === 'sv')?.name
    ?? names.find(n => n.language.name === 'en')?.name
    ?? fallback
}

function titleCase(slug: string): string {
  return slug.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

interface LearnEntry { level: number, move: string }

function extractLearnsets(pokemon: any): { levelUp: LearnEntry[], machine: string[] } {
  const levelUp: LearnEntry[] = []
  const machine = new Set<string>()
  for (const entry of pokemon.moves) {
    for (const detail of entry.version_group_details) {
      if (detail.version_group.name !== VERSION_GROUP) continue
      const method = detail.move_learn_method.name
      if (method === 'level-up') {
        levelUp.push({ level: Math.max(1, detail.level_learned_at), move: entry.move.name })
      } else if (method === 'machine') {
        machine.add(entry.move.name)
      }
    }
  }
  levelUp.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move))
  return { levelUp, machine: [...machine].sort() }
}

function normaliseSpecies(pokemon: any, species: any, evolutions: SpeciesData['evolutions']): SpeciesData {
  const baseStats = {} as StatBlock
  for (const entry of pokemon.stats) {
    const key = STAT_MAP[entry.stat.name]
    if (key) baseStats[key] = entry.base_stat
  }
  const animated = pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated
  const front = pokemon.sprites.front_default as string
  const back = pokemon.sprites.back_default as string
  const learnsets = extractLearnsets(pokemon)
  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: pickName(species.names, titleCase(pokemon.name)),
    types: pokemon.types.sort((a: any, b: any) => a.slot - b.slot).map((t: any) => t.type.name as TypeName),
    baseStats,
    baseExp: pokemon.base_experience ?? 0,
    captureRate: species.capture_rate,
    growthRate: species.growth_rate.name,
    sprites: {
      front: animated?.front_default ?? front,
      back: animated?.back_default ?? back,
      icon: front,
    },
    levelUpMoves: learnsets.levelUp,
    tmMoves: learnsets.machine,
    evolutions,
  }
}

function normaliseMove(move: any): MoveData {
  const meta = move.meta ?? {}
  return {
    id: move.id,
    name: move.name,
    displayName: pickName(move.names ?? [], titleCase(move.name)),
    type: move.type.name as TypeName,
    power: move.power ?? null,
    accuracy: move.accuracy ?? null,
    pp: move.pp ?? 5,
    priority: move.priority ?? 0,
    damageClass: move.damage_class.name as DamageClass,
    target: move.target?.name ?? 'selected-pokemon',
    ailment: meta.ailment?.name ?? 'none',
    ailmentChance: meta.ailment_chance ?? 0,
    critRate: meta.crit_rate ?? 0,
    drain: meta.drain ?? 0,
    healing: meta.healing ?? 0,
    flinchChance: meta.flinch_chance ?? 0,
    minHits: meta.min_hits ?? null,
    maxHits: meta.max_hits ?? null,
    statChance: meta.stat_chance ?? 0,
    statChanges: (move.stat_changes ?? [])
      .filter((change: any) => BATTLE_STAT_MAP[change.stat.name])
      .map((change: any) => ({ stat: BATTLE_STAT_MAP[change.stat.name], change: change.change })),
  }
}

/** Walk an evolution chain and collect level-based evolutions (target must be inside the first MAX_POKEMON). */
function collectEvolutions(node: any, into: Map<number, SpeciesData['evolutions']>) {
  const fromId = idFromUrl(node.species.url)
  for (const next of node.evolves_to) {
    const toId = idFromUrl(next.species.url)
    const detail = (next.evolution_details as any[]).find(d => d.trigger.name === 'level-up' && d.min_level != null)
    if (detail && toId <= MAX_POKEMON && fromId <= MAX_POKEMON) {
      const list = into.get(fromId) ?? []
      list.push({ to: toId, minLevel: detail.min_level })
      into.set(fromId, list)
    }
    collectEvolutions(next, into)
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

async function writeJson(file: string, value: unknown) {
  await writeFile(join(OUT_DIR, file), `${JSON.stringify(value)}\n`)
}

/** One entry per line: compact but still diff-friendly. */
async function writeJsonLines(file: string, entries: unknown[]) {
  await writeFile(join(OUT_DIR, file), `[\n${entries.map(e => JSON.stringify(e)).join(',\n')}\n]\n`)
}

async function main() {
  const started = Date.now()
  await mkdir(OUT_DIR, { recursive: true })
  const ids = Array.from({ length: MAX_POKEMON }, (_, i) => i + 1)

  console.log(`Fetching ${MAX_POKEMON} pokemon + species...`)
  const pokemonRaw = await mapPool(ids, id => get(`/pokemon/${id}`))
  const speciesRaw = await mapPool(ids, id => get(`/pokemon-species/${id}`))

  console.log('Fetching evolution chains...')
  const chainIds = [...new Set(speciesRaw.map(s => idFromUrl(s.evolution_chain.url)))]
  const chains = await mapPool(chainIds, id => get(`/evolution-chain/${id}`))
  const evolutionMap = new Map<number, SpeciesData['evolutions']>()
  for (const chain of chains) collectEvolutions(chain.chain, evolutionMap)

  const species = pokemonRaw.map((pokemon, i) => normaliseSpecies(pokemon, speciesRaw[i], evolutionMap.get(pokemon.id) ?? []))

  const moveNames = new Set<string>()
  for (const s of species) {
    for (const entry of s.levelUpMoves) moveNames.add(entry.move)
    for (const move of s.tmMoves) moveNames.add(move)
  }
  console.log(`Fetching ${moveNames.size} moves...`)
  const sortedMoveNames = [...moveNames].sort()
  const movesRaw = await mapPool(sortedMoveNames, name => get(`/move/${name}`))
  const moves: Record<string, MoveData> = {}
  for (const raw of movesRaw) moves[raw.name] = normaliseMove(raw)

  console.log('Fetching types, natures, growth rates, items...')
  const typeRaw = await mapPool([...TYPE_NAMES], name => get(`/type/${name}`))
  const chart = {} as TypeChart
  typeRaw.forEach((raw, i) => {
    const attacker = TYPE_NAMES[i]
    const row: Partial<Record<TypeName, number>> = {}
    const relations: [string, number][] = [['double_damage_to', 2], ['half_damage_to', 0.5], ['no_damage_to', 0]]
    for (const [key, multiplier] of relations) {
      for (const t of raw.damage_relations[key] as { name: string }[]) {
        if (isType(t.name)) row[t.name] = multiplier
      }
    }
    chart[attacker] = row
  })

  const natureIds = Array.from({ length: 25 }, (_, i) => i + 1)
  const natureRaw = await mapPool(natureIds, id => get(`/nature/${id}`))
  const natures: NatureData[] = natureRaw.map(raw => ({
    name: raw.name,
    displayName: pickName(raw.names ?? [], titleCase(raw.name)),
    increased: raw.increased_stat ? STAT_MAP[raw.increased_stat.name] ?? null : null,
    decreased: raw.decreased_stat ? STAT_MAP[raw.decreased_stat.name] ?? null : null,
  }))

  const growthRaw = await mapPool([1, 2, 3, 4, 5, 6], id => get(`/growth-rate/${id}`))
  const growthRates: GrowthRates = {}
  for (const raw of growthRaw) {
    const table: number[] = [0]
    for (const entry of raw.levels as { level: number, experience: number }[]) table[entry.level] = entry.experience
    growthRates[raw.name] = table
  }

  const items: Record<string, ItemData> = {}
  const itemRaw = await mapPool(ITEM_NAMES, async (name) => {
    try {
      return await get(`/item/${name}`)
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.warn(`  ! item "${name}" not found, skipping`)
        return null
      }
      throw error
    }
  })
  for (const raw of itemRaw) {
    if (!raw) continue
    items[raw.name] = {
      name: raw.name,
      displayName: pickName(raw.names ?? [], titleCase(raw.name)),
      sprite: raw.sprites?.default ?? '',
    }
  }

  await writeJsonLines('pokemon.json', species)
  await writeJson('moves.json', moves)
  await writeJson('types.json', chart)
  await writeJson('natures.json', natures)
  await writeJson('growth-rates.json', growthRates)
  await writeJson('items.json', items)

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`Done in ${seconds}s: ${species.length} species, ${Object.keys(moves).length} moves, ${natures.length} natures, ${Object.keys(items).length} items (${requestsMade} requests, ${cacheHits} cache hits).`)
}

function isType(name: string): name is TypeName {
  return (TYPE_NAMES as readonly string[]).includes(name)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
