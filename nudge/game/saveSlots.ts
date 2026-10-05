// Save slots and cloud sync (PLAN-3 3), pure TypeScript: the data model of a slot, migration of old save files, the decision of what to
// do when a local and a cloud copy meet, and `SaveSync`, the engine that writes locally at once and to the cloud with a debounce.
// The cloud (Supabase) and the local storage are injected, so everything here is tested with fakes.
import type { SaveSummary } from './save'

export const SLOTS = [1, 2, 3] as const
export type Slot = (typeof SLOTS)[number]

export function isSlot(value: unknown): value is Slot {
  return value === 1 || value === 2 || value === 3
}

/** What the browser keeps for a slot: the save, a summary for the menu, and what it knows about the cloud copy. */
export interface LocalSlot {
  slot: Slot
  saveVersion: number
  data: unknown
  summary: SaveSummary
  /** Local time of the last change (ms). */
  updatedAt: number
  /** The cloud `updated_at` this copy was last in sync with (null: never uploaded). */
  cloudUpdatedAt: string | null
  /** Changed locally since the last successful sync. */
  dirty: boolean
  /** Counts local writes, so an upload can tell whether the game saved again while it was running. */
  rev?: number
}

export interface CloudSlot {
  slot: Slot
  saveVersion: number
  summary: SaveSummary
  /** Server time of the last change (ISO). */
  updatedAt: string
  /** Only set by `fetch`. */
  data?: unknown
}

export interface CloudSaves {
  /** Is there a signed-in user and a reachable table? */
  available(): Promise<boolean>
  list(): Promise<CloudSlot[]>
  fetch(slot: Slot): Promise<CloudSlot | null>
  /** Returns the server's new `updated_at`. */
  upsert(slot: Slot, saveVersion: number, data: unknown, summary: SaveSummary): Promise<string>
  remove(slot: Slot): Promise<void>
}

export interface LocalStore {
  get(slot: Slot): LocalSlot | null
  set(slot: Slot, value: LocalSlot): void
  remove(slot: Slot): void
  /** Slots deleted here whose cloud copy could not be deleted yet (so a later sync does not bring them back). */
  tombstones(): Slot[]
  setTombstones(slots: Slot[]): void
}

export type SyncDecision = 'noop' | 'upload' | 'download' | 'conflict'

/**
 * What to do with a slot that exists locally and/or in the cloud.
 * - only one side: copy it to the other;
 * - both, and the cloud copy is the one this browser last synced with: upload when changed locally, otherwise nothing;
 * - both, and the cloud copy changed since: download if the local copy is unchanged, otherwise it is a conflict (both changed),
 *   unless the two are the same game state (then nothing needs to be chosen).
 */
export function decideSync(local: LocalSlot | null, cloud: CloudSlot | null): SyncDecision {
  if (!local && !cloud) return 'noop'
  if (local && !cloud) return 'upload'
  if (!local && cloud) return 'download'
  const l = local!
  const c = cloud!
  if (l.cloudUpdatedAt === c.updatedAt) return l.dirty ? 'upload' : 'noop'
  if (!l.dirty && l.cloudUpdatedAt !== null) return 'download'
  if (sameProgress(l.summary, c.summary)) return 'noop'
  return 'conflict'
}

/** Two summaries that describe the same moment of the game (so a "conflict" between them is none). */
function sameProgress(a: SaveSummary, b: SaveSummary): boolean {
  return a.savedAt === b.savedAt
}

// ---------------------------------------------------------------------------
// Migration of save files
// ---------------------------------------------------------------------------

type Migration = (data: Record<string, any>) => Record<string, any>

/** `MIGRATIONS[n]` upgrades a save of version n to version n + 1. Add one whenever the data model changes. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: play time is tracked.
  1: (data) => {
    data.player = { ...data.player, playTimeMs: data.player?.playTimeMs ?? 0 }
    return data
  },
  // v2 -> v3: the Pokédex knows which species were only seen, and the world remembers the Pokémon Centers used (fast travel).
  2: (data) => {
    const owned: number[] = Array.isArray(data.player?.pokedex) ? data.player.pokedex : []
    data.player = { ...data.player, pokedexSeen: data.player?.pokedexSeen ?? [...owned] }
    const center = data.world?.lastCenter
    data.world = { ...data.world, visitedCenters: data.world?.visitedCenters ?? (center && center.mapId !== 'hemstad' ? [center] : []) }
    return data
  },
  // v3 -> v4: the intro's names and look. Games from before the intro have the old rival and count as having seen it.
  3: (data) => {
    data.player = { ...data.player, rivalName: data.player?.rivalName ?? 'Elias', look: data.player?.look ?? 'player', introDone: data.player?.introDone ?? true }
    // The Pokédex is handed over in the guided first battle's end; games that are further than that have it.
    const flags: string[] = Array.isArray(data.world?.flags) ? data.world.flags : []
    if (flags.includes('starter') && !flags.includes('pokedex')) data.world = { ...data.world, flags: [...flags, 'pokedex'] }
    // Games that are underway have been through everything the notes explain.
    data.player = { ...data.player, notes: data.player?.notes ?? ['atb', 'nudge', 'nature', 'trait', 'trust', 'favorite', 'capture', 'obedience'] }
    return data
  },
}

/** Brings a parsed save of any older version up to `toVersion`. Returns null for saves from the future or without a usable version. */
export function migrateSave(data: unknown, toVersion: number): Record<string, any> | null {
  if (!data || typeof data !== 'object') return null
  let current = JSON.parse(JSON.stringify(data)) as Record<string, any>
  let version = current.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > toVersion) return null
  while (version < toVersion) {
    const step = MIGRATIONS[version]
    if (!step) return null
    current = step(current)
    version++
    current.version = version
  }
  return current
}

// ---------------------------------------------------------------------------
// The sync engine
// ---------------------------------------------------------------------------

export type SyncState = 'local-only' | 'synced' | 'pending' | 'error' | 'conflict'

export interface Conflict {
  slot: Slot
  local: SaveSummary
  cloud: SaveSummary
}

export interface SyncOptions {
  debounceMs?: number
  now?: () => number
  /** Timers are injected so tests control time. */
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  /** Called when the state or the list of conflicts changes. */
  onChange?: () => void
}

export class SaveSync {
  state: SyncState = 'local-only'
  conflicts: Conflict[] = []
  /** Last error text for the settings screen. */
  error: string | null = null
  private timers = new Map<Slot, unknown>()
  private readonly debounceMs: number
  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  constructor(private readonly local: LocalStore, private cloud: CloudSaves | null, private readonly options: SyncOptions = {}) {
    this.debounceMs = options.debounceMs ?? 3000
    this.now = options.now ?? Date.now
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = options.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  setCloud(cloud: CloudSaves | null): void {
    this.cloud = cloud
    this.recompute()
  }

  private changed(): void {
    this.options.onChange?.()
  }

  private recompute(): void {
    const slots = SLOTS.map(s => this.local.get(s)).filter((s): s is LocalSlot => !!s)
    if (this.conflicts.length) this.state = 'conflict'
    else if (this.error) this.state = 'error'
    else if (!this.cloud) this.state = 'local-only'
    else this.state = slots.some(s => s.dirty) ? 'pending' : 'synced'
    this.changed()
  }

  /** Saves the game to the browser at once and schedules the upload. */
  write(slot: Slot, saveVersion: number, data: unknown, summary: SaveSummary): void {
    const previous = this.local.get(slot)
    this.local.set(slot, { slot, saveVersion, data, summary, updatedAt: this.now(), cloudUpdatedAt: previous?.cloudUpdatedAt ?? null, dirty: true, rev: (previous?.rev ?? 0) + 1 })
    this.schedule(slot)
    this.recompute()
  }

  private schedule(slot: Slot): void {
    if (!this.cloud) return
    const existing = this.timers.get(slot)
    if (existing) this.clearTimer(existing)
    this.timers.set(slot, this.setTimer(() => {
      this.timers.delete(slot)
      void this.upload(slot)
    }, this.debounceMs))
  }

  /** Uploads one slot now. A failure keeps the slot dirty and sets the error state (the game goes on). */
  async upload(slot: Slot): Promise<boolean> {
    const l = this.local.get(slot)
    if (!this.cloud || !l || !l.dirty) return true
    if (this.conflicts.some(c => c.slot === slot)) return false
    try {
      const updatedAt = await this.cloud.upsert(slot, l.saveVersion, l.data, l.summary)
      // Only mark it clean if nothing was written meanwhile.
      const now = this.local.get(slot)
      if (now && (now.rev ?? 0) === (l.rev ?? 0)) this.local.set(slot, { ...now, cloudUpdatedAt: updatedAt, dirty: false })
      else if (now) this.local.set(slot, { ...now, cloudUpdatedAt: updatedAt })
      this.error = null
      this.recompute()
      return true
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.recompute()
      return false
    }
  }

  /** Uploads everything that is waiting (page hide, leaving the game). */
  async flush(): Promise<void> {
    for (const [slot, handle] of this.timers) {
      this.clearTimer(handle)
      this.timers.delete(slot)
    }
    for (const slot of SLOTS) await this.upload(slot)
  }

  /**
   * Compares the browser and the cloud, slot by slot (at start and after signing in). Uploads and downloads what is clear;
   * slots where both sides changed become `conflicts` for the player to decide.
   */
  async sync(): Promise<void> {
    if (!this.cloud) return this.recompute()
    this.conflicts = []
    try {
      for (const slot of this.local.tombstones()) {
        await this.cloud.remove(slot)
        this.local.setTombstones(this.local.tombstones().filter(s => s !== slot))
      }
      const cloudSlots = await this.cloud.list()
      for (const slot of SLOTS) {
        const local = this.local.get(slot)
        const cloud = cloudSlots.find(c => c.slot === slot) ?? null
        switch (decideSync(local, cloud)) {
          case 'upload':
            await this.upload(slot)
            break
          case 'download':
            await this.download(slot)
            break
          case 'conflict':
            this.conflicts.push({ slot, local: local!.summary, cloud: cloud!.summary })
            break
          default:
            if (local && cloud && local.cloudUpdatedAt !== cloud.updatedAt) this.local.set(slot, { ...local, cloudUpdatedAt: cloud.updatedAt, dirty: false })
        }
      }
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    }
    this.recompute()
  }

  private async download(slot: Slot): Promise<void> {
    const cloud = await this.cloud!.fetch(slot)
    if (!cloud || cloud.data === undefined) return
    this.local.set(slot, { slot, saveVersion: cloud.saveVersion, data: cloud.data, summary: cloud.summary, updatedAt: this.now(), cloudUpdatedAt: cloud.updatedAt, dirty: false })
  }

  /** The player's answer to a conflict: keep this browser's copy (it overwrites the cloud) or take the cloud copy. */
  async resolve(slot: Slot, keep: 'local' | 'cloud'): Promise<void> {
    this.conflicts = this.conflicts.filter(c => c.slot !== slot)
    try {
      if (keep === 'cloud') await this.download(slot)
      else {
        const l = this.local.get(slot)
        if (l) this.local.set(slot, { ...l, dirty: true })
        await this.upload(slot)
      }
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    }
    this.recompute()
  }

  /** Removes a slot here and in the cloud. */
  async remove(slot: Slot): Promise<void> {
    const handle = this.timers.get(slot)
    if (handle) this.clearTimer(handle)
    this.timers.delete(slot)
    this.local.remove(slot)
    this.conflicts = this.conflicts.filter(c => c.slot !== slot)
    try {
      await this.cloud?.remove(slot)
      this.error = null
    } catch (error) {
      this.local.setTombstones([...new Set([...this.local.tombstones(), slot])])
      this.error = error instanceof Error ? error.message : String(error)
    }
    this.recompute()
  }
}
