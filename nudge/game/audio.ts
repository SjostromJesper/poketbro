// The audio engine (PLAN-2 M2): music with crossfades, jingles that duck the music, overlapping sound effects, Pokémon cries,
// separate music/sfx volume + mute, and a safe start (browsers only allow sound after a click). Pure TypeScript on top of an
// `AudioBackend`, so the logic can be tested without a browser. Nothing in here ever throws because a file is missing.
import { JINGLES, MUSIC, SFX, type JingleId, type MusicId, type SfxId, type SoundDef } from './audio-manifest'

type MusicName = MusicId | (string & {})

export interface AudioSettings {
  /** 0-1 */
  musicVolume: number
  /** 0-1 */
  sfxVolume: number
  muted: boolean
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { musicVolume: 0.5, sfxVolume: 0.7, muted: false }

/** A looping music track. `setVolume` is called often while fading; `start`/`stop` must never throw. */
export interface MusicChannel {
  setVolume(volume: number): void
  start(): void
  stop(): void
}

export interface AudioBackend {
  /** Called from a user gesture. Resolves true when sound can play. */
  unlock(): Promise<boolean>
  /** Plays a one-shot sound. Resolves when it has ended, or at once when it cannot be played. Never rejects. */
  playSound(src: string, options: { volume: number, rate: number }): Promise<void>
  createMusic(src: string): MusicChannel
}

export interface AudioOptions {
  /** Music crossfade time. */
  fadeMs?: number
  /** Music level while a jingle plays (multiplier). */
  duckLevel?: number
  /** Fallback: a jingle never ducks the music for longer than this. */
  maxJingleMs?: number
  /** Replaces the sound tables (tests). */
  catalog?: { music?: Record<string, SoundDef> }
}

interface Track {
  id: MusicName
  def: SoundDef
  channel: MusicChannel
  /** 0-1 fade level on top of the volume settings. */
  level: number
  started: boolean
}

const STEP_MS = 40

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

export class AudioManager {
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }
  private unlocked = false
  private unlocking: Promise<boolean> | null = null
  private current: Track | null = null
  private leaving: Track[] = []
  /** What should be playing once sound is unlocked (and what the game last asked for). */
  private wanted: MusicName | null = null
  private duck = 1
  private duckCount = 0
  private ticker: ReturnType<typeof setInterval> | null = null
  private readonly fadeMs: number
  private readonly duckLevel: number
  private readonly maxJingleMs: number
  private readonly music: Record<string, SoundDef>

  constructor(private readonly backend: AudioBackend, options: AudioOptions = {}) {
    this.fadeMs = options.fadeMs ?? 600
    this.duckLevel = options.duckLevel ?? 0.2
    this.maxJingleMs = options.maxJingleMs ?? 8000
    this.music = options.catalog?.music ?? MUSIC
  }

  // ---------------------------------------------------------------------------
  // Settings and unlocking
  // ---------------------------------------------------------------------------

  setSettings(settings: Partial<AudioSettings>): void {
    this.settings = {
      musicVolume: clamp01(settings.musicVolume ?? this.settings.musicVolume),
      sfxVolume: clamp01(settings.sfxVolume ?? this.settings.sfxVolume),
      muted: settings.muted ?? this.settings.muted,
    }
    this.applyMusicVolume()
  }

  get isUnlocked(): boolean {
    return this.unlocked
  }

  /** Call from the first click/key press. Starts the music that was asked for before the unlock. */
  unlock(): Promise<boolean> {
    if (this.unlocked) return Promise.resolve(true)
    this.unlocking ??= this.backend.unlock().then((ok) => {
      this.unlocked = ok
      this.unlocking = null
      if (ok) this.syncMusic()
      return ok
    }, () => {
      this.unlocking = null
      return false
    })
    return this.unlocking
  }

  // ---------------------------------------------------------------------------
  // Music
  // ---------------------------------------------------------------------------

  /** Switches to another loop with a crossfade. `null` fades the music out. Asking for the track that already plays does nothing. */
  playMusic(id: MusicName | null): void {
    if (this.wanted === id) return
    this.wanted = id
    this.syncMusic()
  }

  get musicId(): MusicName | null {
    return this.wanted
  }

  private syncMusic(): void {
    if (!this.unlocked) return
    const id = this.wanted
    if (this.current?.id === id) return
    if (this.current) {
      this.leaving.push(this.current)
      this.current = null
    }
    const def = id ? this.music[id] : undefined
    if (id && def) {
      try {
        const channel = this.backend.createMusic(def.src)
        this.current = { id, def, channel, level: 0, started: false }
        channel.setVolume(this.volumeOf(this.current))
        channel.start()
        this.current.started = true
      } catch {
        this.current = null
      }
    }
    this.ensureTicker()
  }

  private volumeOf(track: Track): number {
    if (this.settings.muted) return 0
    return clamp01(this.settings.musicVolume * (track.def.volume ?? 1) * this.duck * track.level)
  }

  private applyMusicVolume(): void {
    for (const track of [this.current, ...this.leaving]) {
      if (!track) continue
      try {
        track.channel.setVolume(this.volumeOf(track))
      } catch {
        // ignore
      }
    }
  }

  private ensureTicker(): void {
    if (this.ticker) return
    this.ticker = setInterval(() => this.tick(STEP_MS), STEP_MS)
  }

  /** Advances the fades. Exposed for tests; the manager runs it on a timer by itself. */
  tick(dtMs: number): void {
    const step = this.fadeMs > 0 ? dtMs / this.fadeMs : 1
    let busy = false
    if (this.current && this.current.level < 1) {
      this.current.level = Math.min(1, this.current.level + step)
      busy ||= this.current.level < 1
    }
    for (const track of [...this.leaving]) {
      track.level = Math.max(0, track.level - step)
      if (track.level <= 0) {
        this.leaving.splice(this.leaving.indexOf(track), 1)
        try {
          track.channel.stop()
        } catch {
          // ignore
        }
      } else {
        busy = true
      }
    }
    this.applyMusicVolume()
    if (!busy && this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }

  // ---------------------------------------------------------------------------
  // One-shot sounds
  // ---------------------------------------------------------------------------

  private play(def: SoundDef | undefined, rate = 1, gain = 1): Promise<void> {
    if (!def || !this.unlocked || this.settings.muted) return Promise.resolve()
    const volume = clamp01(this.settings.sfxVolume * (def.volume ?? 1) * gain)
    if (volume <= 0) return Promise.resolve()
    try {
      return this.backend.playSound(def.src, { volume, rate }).catch(() => undefined)
    } catch {
      return Promise.resolve()
    }
  }

  /** Sound effects overlap freely: every call starts a new voice. */
  sfx(id: SfxId, options: { rate?: number, gain?: number } = {}): void {
    void this.play(SFX[id], options.rate, options.gain)
  }

  /** A Pokémon cry from its URL (PokeAPI). `rate` below 1 lowers the pitch, used for fainting. */
  cry(url: string | undefined, options: { rate?: number } = {}): void {
    if (!url) return
    void this.play({ src: url, volume: 0.9 }, options.rate ?? 1)
  }

  /** Plays a jingle and ducks the music meanwhile. The promise resolves when the jingle is over (or could not play). */
  jingle(id: JingleId): Promise<void> {
    const played = this.play(JINGLES[id])
    if (!this.unlocked || this.settings.muted) return played
    this.duckCount++
    this.duck = this.duckLevel
    this.applyMusicVolume()
    let released = false
    const release = () => {
      if (released) return
      released = true
      this.duckCount = Math.max(0, this.duckCount - 1)
      if (this.duckCount === 0) {
        this.duck = 1
        this.applyMusicVolume()
      }
    }
    const timer = setTimeout(release, this.maxJingleMs)
    return played.then(() => {
      clearTimeout(timer)
      release()
    })
  }

  /** Stops everything (leaving the game screen). */
  stopAll(): void {
    this.wanted = null
    for (const track of [this.current, ...this.leaving]) {
      try {
        track?.channel.stop()
      } catch {
        // ignore
      }
    }
    this.current = null
    this.leaving = []
    if (this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }
}
