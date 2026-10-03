import { getAudioContext, resumeAudioContext } from './audioContext'

export type TypewriterSound =
  | 'key'
  | 'spacebar'
  | 'backspace'
  | 'return_bell'
  | 'error'

export type AudioSettings = {
  enabled: boolean
  volume: number // 0..1
  modeGain: number // per-mode multiplier
}

type BufferMap = Partial<Record<string, AudioBuffer>>

const base = import.meta.env.BASE_URL

const SAMPLE_URLS = {
  key: [`${base}audio/key_1.wav`, `${base}audio/key_2.wav`, `${base}audio/key_3.wav`, `${base}audio/key_4.wav`],
  spacebar: [`${base}audio/spacebar.wav`],
  backspace: [`${base}audio/backspace.wav`],
  return_bell: [`${base}audio/return_bell.wav`],
  error: [`${base}audio/error.wav`],
} as const

export class TypewriterAudio {
  private buffers: BufferMap = {}
  private ready = false
  private inFlight: Promise<void> | null = null
  private active: Array<{ stopAt: number; stop: () => void }> = []

  async ensureReady(): Promise<void> {
    if (this.ready) return
    if (this.inFlight) return this.inFlight

    this.inFlight = (async () => {
      // Shared context is created lazily (must be user-gesture triggered to fully unlock in many browsers)
      const ctx = getAudioContext()
      if (!ctx) {
        this.ready = true
        return
      }

      const fetchDecode = async (url: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch failed')
        const ab = await res.arrayBuffer()
        return await ctx.decodeAudioData(ab)
      }

      // Try to preload samples, but tolerate missing files.
      const entries = Object.entries(SAMPLE_URLS) as Array<[keyof typeof SAMPLE_URLS, readonly string[]]>
      await Promise.all(
        entries.flatMap(([kind, urls]) =>
          urls.map(async (u) => {
            try {
              const b = await fetchDecode(u)
              this.buffers[`${kind}:${u}`] = b
            } catch {
              // ignore (we'll synthesize fallback)
            }
          }),
        ),
      )

      this.ready = true
    })()

    return this.inFlight
  }

  async resume() {
    await resumeAudioContext()
  }

  play(kind: TypewriterSound, settings: AudioSettings) {
    if (!settings.enabled) return
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    // polyphony cap
    const now = ctx.currentTime
    this.active = this.active.filter((a) => a.stopAt > now)
    while (this.active.length >= 6) {
      const oldest = this.active.shift()
      oldest?.stop()
    }

    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(1, settings.volume)) * settings.modeGain
    gain.connect(ctx.destination)

    const tryBuffer = () => {
      const urls = SAMPLE_URLS[kind]
      const url = urls[Math.floor(Math.random() * urls.length)]
      const key = `${kind}:${url}`
      const buf = this.buffers[key]
      if (!buf) return null

      const src = ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = 0.98 + Math.random() * 0.06
      src.connect(gain)
      src.start()
      const stopAt = now + buf.duration
      this.active.push({ stopAt, stop: () => src.stop() })
      return true
    }

    if (tryBuffer()) return

    // Synth fallback: short noise click / bell
    const dur = kind === 'return_bell' ? 0.12 : 0.03
    const src = ctx.createBufferSource()
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buffer.getChannelData(0)

    if (kind === 'return_bell') {
      // simple bell-ish tone
      const freq = 880
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate
        const env = Math.exp(-t * 18)
        data[i] = Math.sin(2 * Math.PI * freq * t) * env
      }
    } else {
      // click/noise
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length
        const env = Math.exp(-t * 10)
        data[i] = (Math.random() * 2 - 1) * env
      }
    }

    src.buffer = buffer
    src.playbackRate.value = 0.98 + Math.random() * 0.06
    src.connect(gain)
    src.start()
    const stopAt = now + dur
    this.active.push({ stopAt, stop: () => src.stop() })
  }
}

export const typewriterAudio = new TypewriterAudio()
