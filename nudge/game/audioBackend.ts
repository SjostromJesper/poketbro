// The browser side of the audio engine: Web Audio for short sounds (cheap overlapping voices, pitch via playbackRate) and an
// <audio> element per music track (streams, loops). Every failure (missing file, blocked autoplay, decode error) is swallowed.
import type { AudioBackend, MusicChannel } from './audio'

type AudioContextCtor = typeof AudioContext

export class WebAudioBackend implements AudioBackend {
  private context: AudioContext | null = null
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>()
  private warned = new Set<string>()

  private warn(src: string, error: unknown): void {
    if (this.warned.has(src)) return
    this.warned.add(src)
    console.warn(`[audio] could not load ${src}`, error)
  }

  async unlock(): Promise<boolean> {
    try {
      if (!this.context) {
        const Ctor: AudioContextCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
        if (!Ctor) return false
        this.context = new Ctor()
      }
      if (this.context.state !== 'running') await this.context.resume()
      return this.context.state === 'running'
    } catch {
      return false
    }
  }

  private load(src: string): Promise<AudioBuffer | null> {
    let promise = this.buffers.get(src)
    if (!promise) {
      promise = (async () => {
        try {
          const response = await fetch(src)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.arrayBuffer()
          return await this.context!.decodeAudioData(data)
        } catch (error) {
          this.warn(src, error)
          return null
        }
      })()
      this.buffers.set(src, promise)
    }
    return promise
  }

  async playSound(src: string, options: { volume: number, rate: number }): Promise<void> {
    const context = this.context
    if (!context) return
    const buffer = await this.load(src)
    if (!buffer) return
    await new Promise<void>((resolve) => {
      try {
        const source = context.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = options.rate
        const gain = context.createGain()
        gain.gain.value = options.volume
        source.connect(gain).connect(context.destination)
        source.onended = () => resolve()
        source.start()
      } catch {
        resolve()
      }
    })
  }

  createMusic(src: string): MusicChannel {
    let element: HTMLAudioElement | null = null
    let volume = 0
    const ensure = (): HTMLAudioElement | null => {
      if (element) return element
      try {
        element = new Audio(src)
        element.loop = true
        element.preload = 'auto'
        element.volume = volume
        element.addEventListener('error', () => this.warn(src, element?.error))
      } catch {
        element = null
      }
      return element
    }
    return {
      setVolume(value: number) {
        volume = Math.max(0, Math.min(1, value))
        if (element) element.volume = volume
      },
      start() {
        const el = ensure()
        if (!el) return
        el.volume = volume
        el.play().catch(() => undefined)
      },
      stop() {
        if (!element) return
        try {
          element.pause()
          element.removeAttribute('src')
          element.load()
        } catch {
          // ignore
        }
        element = null
      },
    }
  }
}
