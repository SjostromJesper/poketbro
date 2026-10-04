// Thin wrapper around localStorage that also works without it (private mode, tests): falls back to memory.
const memory = new Map<string, string>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readItem(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

export function writeItem(key: string, value: string): boolean {
  memory.set(key, value)
  try {
    storage()?.setItem(key, value)
    return true
  } catch {
    // Quota or privacy mode: the in-memory copy still lets "Continue" work until the tab closes.
    return false
  }
}

export function removeItem(key: string): void {
  memory.delete(key)
  try {
    storage()?.removeItem(key)
  } catch {
    // ignore
  }
}
