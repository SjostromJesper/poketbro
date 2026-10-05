// Pure helpers for accounts and the public player id (PLAN-4 2.1): `Name #1452`.
export const MAX_DISPLAY_NAME = 10
export const MIN_TAG = 1000
/** The highest 4-digit tag; when they run out the server continues with 5 digits (up to `MAX_TAG`). */
export const MAX_4_DIGIT_TAG = 9999
export const MAX_TAG = 99999

export interface Profile {
  displayName: string
  tag: number
}

/** `Namn #1452`. */
export function formatPlayer(profile: Profile | { displayName: string, tag: number }): string {
  return `${profile.displayName} #${profile.tag}`
}

/** Reads an id typed by a player ("#1452", "1452", " # 1452 "): the number, or null when it is not a valid tag. */
export function parseTag(input: string): number | null {
  const m = /^\s*#?\s*(\d{4,5})\s*$/.exec(input)
  if (!m) return null
  const tag = Number(m[1])
  return tag >= MIN_TAG && tag <= MAX_TAG ? tag : null
}

/** A trainer name as the server keeps it: trimmed, at most 10 characters, not empty (null = not allowed). */
export function cleanDisplayName(input: string): string | null {
  const name = input.trim().slice(0, MAX_DISPLAY_NAME)
  return name.length > 0 ? name : null
}

/** Basic e-mail and password checks for the sign-up form (the server decides in the end). */
export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Skriv en giltig e-postadress.'
  if (password.length < 6) return 'Lösenordet måste vara minst 6 tecken.'
  return null
}

/** What a session means for playing: an e-mail account may play, an anonymous one must create an account first, none must sign in. */
export type AccessState = 'signed-out' | 'anonymous' | 'account'

export function accessOf(user: { is_anonymous?: boolean, email?: string | null } | null | undefined): AccessState {
  if (!user) return 'signed-out'
  if (user.is_anonymous || !user.email) return 'anonymous'
  return 'account'
}
