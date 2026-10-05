// The names the player picked in the intro (PLAN-4 1.2), for text that is written before they are known: "{player}" and "{rival}" in dialog,
// trainer names and cutscene text are replaced when shown. Module state because every text on screen needs it (set by the game store).
export const DEFAULT_PLAYER_NAME = 'Du'
export const DEFAULT_RIVAL_NAME = 'Elias'

const names = { player: DEFAULT_PLAYER_NAME, rival: DEFAULT_RIVAL_NAME }

export function setNames(player: string, rival: string): void {
  names.player = player || DEFAULT_PLAYER_NAME
  names.rival = rival || DEFAULT_RIVAL_NAME
}

export function currentNames(): Readonly<{ player: string, rival: string }> {
  return names
}

/** Replaces `{player}` and `{rival}` (other `{...}` are left alone). */
export function fillNames(text: string): string {
  return text.includes('{') ? text.replace(/\{(player|rival)\}/g, (_, key: 'player' | 'rival') => names[key]) : text
}
