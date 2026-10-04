import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioManager, type AudioBackend, type MusicChannel } from '../game/audio'
import { JINGLES, MUSIC, SFX } from '../game/audio-manifest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

class FakeChannel implements MusicChannel {
  volume = 0
  started = false
  stopped = false
  constructor(readonly src: string) {}
  setVolume(volume: number) { this.volume = volume }
  start() { this.started = true }
  stop() { this.stopped = true }
}

class FakeBackend implements AudioBackend {
  unlockResult = true
  channels: FakeChannel[] = []
  sounds: { src: string, volume: number, rate: number, finish: () => void }[] = []
  async unlock() { return this.unlockResult }
  playSound(src: string, options: { volume: number, rate: number }) {
    return new Promise<void>((resolve) => { this.sounds.push({ src, ...options, finish: resolve }) })
  }
  createMusic(src: string) {
    const channel = new FakeChannel(src)
    this.channels.push(channel)
    return channel
  }
}

const TRACKS = { a: { src: '/music/a.ogg' }, b: { src: '/music/b.ogg', volume: 0.5 } }

describe('AudioManager', () => {
  let backend: FakeBackend
  let audio: AudioManager

  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(MUSIC, TRACKS)
    backend = new FakeBackend()
    audio = new AudioManager(backend, { fadeMs: 600, duckLevel: 0.2 })
  })
  afterEach(() => {
    for (const key of Object.keys(TRACKS)) delete MUSIC[key]
    audio.stopAll()
    vi.useRealTimers()
  })

  it('stays silent until unlocked, then starts the music that was asked for', async () => {
    audio.playMusic('a')
    audio.sfx('menuConfirm')
    expect(backend.channels).toHaveLength(0)
    expect(backend.sounds).toHaveLength(0)
    await audio.unlock()
    expect(backend.channels.map(c => c.src)).toEqual(['/music/a.ogg'])
    expect(backend.channels[0].started).toBe(true)
    audio.sfx('menuConfirm')
    expect(backend.sounds).toHaveLength(1)
  })

  it('does not crash and stays silent when the browser refuses to unlock', async () => {
    backend.unlockResult = false
    audio.playMusic('a')
    expect(await audio.unlock()).toBe(false)
    audio.sfx('hitNormal')
    expect(backend.channels).toHaveLength(0)
    expect(backend.sounds).toHaveLength(0)
  })

  it('crossfades between two tracks in about 600 ms', async () => {
    await audio.unlock()
    audio.setSettings({ musicVolume: 1 })
    audio.playMusic('a')
    vi.advanceTimersByTime(700)
    const [a] = backend.channels
    expect(a.volume).toBeCloseTo(1, 1)

    audio.playMusic('b')
    const b = backend.channels[1]
    vi.advanceTimersByTime(300)
    // halfway: a goes down, b comes up (b has its own gain 0.5)
    expect(a.volume).toBeCloseTo(0.5, 1)
    expect(b.volume).toBeCloseTo(0.25, 1)
    expect(a.stopped).toBe(false)
    vi.advanceTimersByTime(400)
    expect(a.stopped).toBe(true)
    expect(b.volume).toBeCloseTo(0.5, 2)
  })

  it('ignores a request for the track that is already playing', async () => {
    await audio.unlock()
    audio.playMusic('a')
    audio.playMusic('a')
    expect(backend.channels).toHaveLength(1)
  })

  it('fades the music out for null', async () => {
    await audio.unlock()
    audio.playMusic('a')
    vi.advanceTimersByTime(700)
    audio.playMusic(null)
    vi.advanceTimersByTime(700)
    expect(backend.channels[0].stopped).toBe(true)
  })

  it('keeps music and sound volume apart and honours mute', async () => {
    await audio.unlock()
    audio.setSettings({ musicVolume: 0.4, sfxVolume: 0.8 })
    audio.playMusic('a')
    vi.advanceTimersByTime(700)
    expect(backend.channels[0].volume).toBeCloseTo(0.4, 2)
    audio.sfx('hitNormal', { gain: 1 })
    expect(backend.sounds[0].volume).toBeCloseTo(0.8 * (SFX.hitNormal.volume ?? 1), 5)

    audio.setSettings({ muted: true })
    expect(backend.channels[0].volume).toBe(0)
    audio.sfx('hitNormal')
    expect(backend.sounds).toHaveLength(1)
    audio.setSettings({ muted: false })
    expect(backend.channels[0].volume).toBeCloseTo(0.4, 2)
  })

  it('lets sound effects overlap and passes the pitch on', async () => {
    await audio.unlock()
    audio.sfx('hitNormal')
    audio.sfx('hitNormal')
    audio.cry('https://example.test/25.ogg', { rate: 0.7 })
    expect(backend.sounds).toHaveLength(3)
    expect(backend.sounds[2]).toMatchObject({ src: 'https://example.test/25.ogg', rate: 0.7 })
    audio.cry(undefined)
    expect(backend.sounds).toHaveLength(3)
  })

  it('ducks the music during a jingle and restores it afterwards', async () => {
    await audio.unlock()
    audio.setSettings({ musicVolume: 1 })
    audio.playMusic('a')
    vi.advanceTimersByTime(700)
    const done = vi.fn()
    void audio.jingle('levelUp').then(done)
    expect(backend.channels[0].volume).toBeCloseTo(0.2, 2)
    expect(done).not.toHaveBeenCalled()
    backend.sounds[0].finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toHaveBeenCalled()
    expect(backend.channels[0].volume).toBeCloseTo(1, 2)
  })

  it('never keeps the music ducked forever if a jingle never ends', async () => {
    await audio.unlock()
    audio.setSettings({ musicVolume: 1 })
    audio.playMusic('a')
    vi.advanceTimersByTime(700)
    void audio.jingle('victory')
    vi.advanceTimersByTime(9000)
    expect(backend.channels[0].volume).toBeCloseTo(1, 2)
  })

  it('survives a backend that throws', async () => {
    const broken: AudioBackend = {
      unlock: async () => true,
      playSound: () => { throw new Error('boom') },
      createMusic: () => { throw new Error('boom') },
    }
    const manager = new AudioManager(broken)
    await manager.unlock()
    expect(() => {
      manager.playMusic('a')
      manager.sfx('hitNormal')
      void manager.jingle('levelUp')
    }).not.toThrow()
    manager.stopAll()
  })
})

describe('audio manifest', () => {
  it('only references files that exist in public/', () => {
    const missing = [...Object.values(SFX), ...Object.values(JINGLES), ...Object.values(MUSIC)]
      .map(def => def.src)
      .filter(src => !existsSync(join(__dirname, '..', '..', 'public', src)))
    expect(missing).toEqual([])
  })
})
