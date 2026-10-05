// The registry of graphics themes.
import { kenney } from './kenney'
import { ninja } from './ninja'
import { pipoya } from './pipoya'
import { tuxemon } from './tuxemon'
import type { ThemeId, ThemeManifest } from './types'

export const THEMES: Record<ThemeId, ThemeManifest> = { tuxemon, ninja, pipoya, kenney }

/** The theme new players get. */
export const DEFAULT_THEME: ThemeId = 'tuxemon'

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES
}

export function getTheme(id: ThemeId): ThemeManifest {
  return THEMES[id] ?? THEMES[DEFAULT_THEME]
}
