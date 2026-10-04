// Seeded randomness. The engine never touches Math.random() directly: everything goes through an Rng that is passed in.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
}

/** mulberry32: tiny, fast, good enough for a game. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6D2B79F5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** An Rng backed by Math.random(), for the UI layer only (never used inside the engine itself). */
export function createRandomRng(): Rng {
  return { next: () => Math.random() }
}

/** Integer in [min, max], inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1))
}

export function chance(rng: Rng, probability: number): boolean {
  return rng.next() < probability
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)]
}

/** Index drawn from a (not necessarily normalised) list of non-negative weights. Returns -1 if all weights are 0. */
export function pickWeightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0
  for (const w of weights) total += Math.max(0, w)
  if (total <= 0) return -1
  let roll = rng.next() * total
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i])
    if (roll < 0) return i
  }
  return weights.length - 1
}

export function randomUid(rng: Rng): string {
  return Array.from({ length: 4 }, () => Math.floor(rng.next() * 0x10000).toString(16).padStart(4, '0')).join('')
}
