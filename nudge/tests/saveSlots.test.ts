import { describe, expect, it, vi } from 'vitest'
import { parseSave, SAVE_VERSION, serializeSave, summarizeSave, type PlayerData, type SaveSummary } from '../game/save'
import { decideSync, migrateSave, SaveSync, type CloudSaves, type CloudSlot, type LocalSlot, type LocalStore, type Slot } from '../game/saveSlots'
import { newWorldState } from '../game/world'
import { mon } from './helpers'

const summary = (savedAt: number, badges = 0): SaveSummary => ({
  playerName: 'Du', partyIcons: [4], playTimeMs: 0, leadName: 'Charmander', leadSpeciesId: 4, leadLevel: 12, partySize: 1, badges, money: 0, placeName: 'Hemstad', savedAt,
})

class MemoryLocal implements LocalStore {
  slots = new Map<Slot, LocalSlot>()
  deleted: Slot[] = []
  get(slot: Slot) { return this.slots.get(slot) ?? null }
  set(slot: Slot, value: LocalSlot) { this.slots.set(slot, value) }
  remove(slot: Slot) { this.slots.delete(slot) }
  tombstones() { return [...this.deleted] }
  setTombstones(slots: Slot[]) { this.deleted = [...slots] }
}

class FakeCloud implements CloudSaves {
  rows = new Map<Slot, CloudSlot>()
  clock = 0
  failing = false
  uploads = 0
  async available() { return true }
  private guard() { if (this.failing) throw new Error('offline') }
  async list() { this.guard(); return [...this.rows.values()].map(r => ({ ...r, data: undefined })) }
  async fetch(slot: Slot) { this.guard(); return this.rows.get(slot) ?? null }
  async upsert(slot: Slot, saveVersion: number, data: unknown, s: SaveSummary) {
    this.guard()
    this.uploads++
    const updatedAt = `2026-01-01T00:00:${String(++this.clock).padStart(2, '0')}Z`
    this.rows.set(slot, { slot, saveVersion, data, summary: s, updatedAt })
    return updatedAt
  }
  async remove(slot: Slot) { this.guard(); this.rows.delete(slot) }
}

function fakeTimers() {
  const pending: { fn: () => void, at: number, id: number }[] = []
  let now = 0
  let id = 0
  return {
    setTimer: (fn: () => void, ms: number) => { pending.push({ fn, at: now + ms, id: ++id }); return id },
    clearTimer: (handle: unknown) => { const i = pending.findIndex(p => p.id === handle); if (i >= 0) pending.splice(i, 1) },
    advance(ms: number) {
      now += ms
      for (const p of pending.filter(p => p.at <= now)) { pending.splice(pending.indexOf(p), 1); p.fn() }
    },
    now: () => now,
    count: () => pending.length,
  }
}

const player: PlayerData = { name: 'Du', party: [mon('charmander', 5)], box: [], money: 10, bag: {}, badges: [], pokedex: [4], pokedexSeen: [4], stepRemainder: 0, playTimeMs: 5 }

describe('migrating saves', () => {
  it('upgrades a version 1 save (no play time) and refuses unknown versions', () => {
    const v1 = JSON.parse(serializeSave(player, newWorldState(), 1))
    v1.version = 1
    delete v1.player.playTimeMs
    const migrated = migrateSave(v1, SAVE_VERSION)!
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.playTimeMs).toBe(0)
    expect(parseSave(JSON.stringify(v1)).ok).toBe(true)
    expect(migrateSave({ ...v1, version: SAVE_VERSION + 1 }, SAVE_VERSION)).toBeNull()
    expect(migrateSave({ version: 'x' }, SAVE_VERSION)).toBeNull()
    expect(migrateSave(null, SAVE_VERSION)).toBeNull()
    // the input is not modified
    expect(v1.version).toBe(1)
  })

  it('a current save passes through unchanged', () => {
    const current = JSON.parse(serializeSave(player, newWorldState(), 1))
    expect(migrateSave(current, SAVE_VERSION)).toEqual(current)
    expect(summarizeSave((parseSave(JSON.stringify(current)) as { ok: true, save: never }).save).playerName).toBe('Du')
  })
})

describe('deciding what to sync', () => {
  const local = (patch: Partial<LocalSlot> = {}): LocalSlot => ({ slot: 1, saveVersion: 2, data: {}, summary: summary(10), updatedAt: 10, cloudUpdatedAt: null, dirty: true, ...patch })
  const cloud = (patch: Partial<CloudSlot> = {}): CloudSlot => ({ slot: 1, saveVersion: 2, summary: summary(20), updatedAt: 'c1', ...patch })

  it('copies a slot that exists on one side only', () => {
    expect(decideSync(null, null)).toBe('noop')
    expect(decideSync(local(), null)).toBe('upload')
    expect(decideSync(null, cloud())).toBe('download')
  })

  it('uploads local changes made since the last sync, otherwise does nothing', () => {
    expect(decideSync(local({ cloudUpdatedAt: 'c1', dirty: true }), cloud())).toBe('upload')
    expect(decideSync(local({ cloudUpdatedAt: 'c1', dirty: false }), cloud())).toBe('noop')
  })

  it('downloads when only the cloud changed, and asks when both changed', () => {
    expect(decideSync(local({ cloudUpdatedAt: 'c0', dirty: false }), cloud({ updatedAt: 'c1' }))).toBe('download')
    expect(decideSync(local({ cloudUpdatedAt: 'c0', dirty: true }), cloud({ updatedAt: 'c1' }))).toBe('conflict')
    // a browser that never synced with a cloud copy that exists: both sides are new
    expect(decideSync(local({ cloudUpdatedAt: null, dirty: true }), cloud())).toBe('conflict')
  })

  it('does not ask when both describe the very same moment', () => {
    expect(decideSync(local({ cloudUpdatedAt: null, summary: summary(50) }), cloud({ summary: summary(50) }))).toBe('noop')
  })
})

describe('the sync engine', () => {
  function setup(cloudOn = true) {
    const store = new MemoryLocal()
    const cloud = new FakeCloud()
    const timers = fakeTimers()
    const sync = new SaveSync(store, cloudOn ? cloud : null, { ...timers, debounceMs: 3000 })
    return { store, cloud, timers, sync }
  }

  it('writes locally at once and uploads once after the pause, however many saves come in', async () => {
    const { store, cloud, timers, sync } = setup()
    sync.write(1, 2, { n: 1 }, summary(1))
    sync.write(1, 2, { n: 2 }, summary(2))
    sync.write(1, 2, { n: 3 }, summary(3))
    expect(store.get(1)!.data).toEqual({ n: 3 })
    expect(store.get(1)!.dirty).toBe(true)
    expect(sync.state).toBe('pending')
    expect(cloud.uploads).toBe(0)
    timers.advance(2999)
    expect(cloud.uploads).toBe(0)
    timers.advance(1)
    await vi.waitFor(() => expect(cloud.uploads).toBe(1))
    await vi.waitFor(() => expect(sync.state).toBe('synced'))
    expect(cloud.rows.get(1)!.data).toEqual({ n: 3 })
    expect(store.get(1)).toMatchObject({ dirty: false, cloudUpdatedAt: cloud.rows.get(1)!.updatedAt })
  })

  it('flush uploads at once (page hide)', async () => {
    const { cloud, timers, sync } = setup()
    sync.write(2, 2, { a: 1 }, summary(1))
    await sync.flush()
    expect(cloud.uploads).toBe(1)
    expect(timers.count()).toBe(0)
  })

  it('works offline: the game keeps saving locally and the failed upload is retried later', async () => {
    const { store, cloud, sync } = setup()
    cloud.failing = true
    sync.write(1, 2, { a: 1 }, summary(1))
    await sync.flush()
    expect(sync.state).toBe('error')
    expect(sync.error).toBe('offline')
    expect(store.get(1)!.dirty).toBe(true)
    cloud.failing = false
    await sync.flush()
    expect(sync.state).toBe('synced')
    expect(cloud.rows.get(1)!.data).toEqual({ a: 1 })
  })

  it('without a cloud everything stays local', () => {
    const { store, sync } = setup(false)
    sync.write(1, 2, { a: 1 }, summary(1))
    expect(sync.state).toBe('local-only')
    expect(store.get(1)).toBeTruthy()
  })

  it('on start: uploads local-only slots, downloads cloud-only slots and keeps in-sync slots', async () => {
    const { store, cloud, sync } = setup()
    store.set(1, { slot: 1, saveVersion: 2, data: { me: 1 }, summary: summary(1), updatedAt: 1, cloudUpdatedAt: null, dirty: true })
    cloud.rows.set(2, { slot: 2, saveVersion: 2, data: { them: 2 }, summary: summary(2), updatedAt: 'x2' })
    await sync.sync()
    expect(cloud.rows.get(1)!.data).toEqual({ me: 1 })
    expect(store.get(2)).toMatchObject({ data: { them: 2 }, cloudUpdatedAt: 'x2', dirty: false })
    expect(sync.conflicts).toEqual([])
    expect(sync.state).toBe('synced')
  })

  it('reports a conflict when both changed and applies the player\'s choice', async () => {
    const { store, cloud, sync } = setup()
    store.set(1, { slot: 1, saveVersion: 2, data: { side: 'local' }, summary: summary(5, 1), updatedAt: 5, cloudUpdatedAt: 'old', dirty: true })
    cloud.rows.set(1, { slot: 1, saveVersion: 2, data: { side: 'cloud' }, summary: summary(6, 2), updatedAt: 'new' })
    await sync.sync()
    expect(sync.state).toBe('conflict')
    expect(sync.conflicts).toEqual([{ slot: 1, local: summary(5, 1), cloud: summary(6, 2) }])
    // nothing is overwritten while the question is open
    expect(cloud.rows.get(1)!.data).toEqual({ side: 'cloud' })
    expect(store.get(1)!.data).toEqual({ side: 'local' })

    await sync.resolve(1, 'cloud')
    expect(store.get(1)).toMatchObject({ data: { side: 'cloud' }, dirty: false })
    expect(sync.conflicts).toEqual([])
  })

  it('keeping the local copy overwrites the cloud', async () => {
    const { store, cloud, sync } = setup()
    store.set(1, { slot: 1, saveVersion: 2, data: { side: 'local' }, summary: summary(5), updatedAt: 5, cloudUpdatedAt: 'old', dirty: true })
    cloud.rows.set(1, { slot: 1, saveVersion: 2, data: { side: 'cloud' }, summary: summary(6), updatedAt: 'new' })
    await sync.sync()
    await sync.resolve(1, 'local')
    expect(cloud.rows.get(1)!.data).toEqual({ side: 'local' })
    expect(sync.state).toBe('synced')
  })

  it('a change made while an upload is running is not lost', async () => {
    const { store, cloud, sync } = setup()
    const upsert = cloud.upsert.bind(cloud)
    cloud.upsert = async (...args) => {
      sync.write(1, 2, { n: 2 }, summary(2)) // the game saves again during the upload
      return upsert(...args)
    }
    sync.write(1, 2, { n: 1 }, summary(1))
    await sync.upload(1)
    expect(store.get(1)!.dirty).toBe(true)
    expect(store.get(1)!.data).toEqual({ n: 2 })
  })

  it('deleting removes it in both places, and an offline delete is remembered so the slot does not come back', async () => {
    const { store, cloud, sync } = setup()
    sync.write(3, 2, { a: 1 }, summary(1))
    await sync.flush()
    cloud.failing = true
    await sync.remove(3)
    expect(store.get(3)).toBeNull()
    expect(store.deleted).toEqual([3])
    cloud.failing = false
    await sync.sync()
    expect(cloud.rows.has(3)).toBe(false)
    expect(store.get(3)).toBeNull()
    expect(store.deleted).toEqual([])
  })
})
