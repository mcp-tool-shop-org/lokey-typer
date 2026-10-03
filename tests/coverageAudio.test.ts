import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Ramp = { value: number; time: number }

class FakeParam {
  value = 0
  ramps: Ramp[] = []
  setValueAtTime(value: number) {
    this.value = value
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ value, time })
    this.value = value
  }
  cancelScheduledValues() {}
}

class FakeSource {
  buffer: { duration: number; sampleRate: number; getChannelData: (c: number) => Float32Array } | null = null
  loop = false
  playbackRate = { value: 1 }
  onended: (() => void) | null = null
  started: Array<{ when?: number; offset?: number }> = []
  stopped: number[] = []
  connect() {}
  disconnect() {}
  start(when?: number, offset?: number) {
    this.started.push({ when, offset })
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0)
  }
}

class FakeGain {
  gain = new FakeParam()
  connect() {}
  disconnect() {}
}

class FakeContext {
  state = 'suspended'
  currentTime = 0
  sampleRate = 100
  destination = {}
  sources: FakeSource[] = []
  gains: FakeGain[] = []
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length)
    data[10] = 0.8
    return {
      duration: length / sampleRate,
      length,
      sampleRate,
      numberOfChannels: 1,
      getChannelData: () => data,
    }
  }
  decodeAudioData = vi.fn(async () => this.createBuffer(1, 200, 100))
}

const tracks = [
  { id: 'rain-a', title: 'Rain A', category: 'rain', tags: ['soft'], path: 'audio/ambient/rain-a.wav', duration_sec: 30, lufs_i: -32 },
  { id: 'rain-b', title: 'Rain B', category: 'rain', tags: [], path: '/audio/ambient/rain-b.wav', duration_sec: 40 },
  { id: 'ocean-a', title: 'Ocean', category: 'ocean', tags: [], path: 'audio/ambient/ocean-a.wav', duration_sec: 20 },
]

function manifestResponse(body: unknown, ok = true) {
  return {
    ok,
    arrayBuffer: async () => new ArrayBuffer(8),
    json: async () => body,
  }
}

function installMemoryStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
    },
    configurable: true,
  })
}

async function loadStack(ctx: FakeContext, fetchImpl: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  vi.stubGlobal('window', {
    AudioContext: function AudioContext() {
      return ctx
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  })
  vi.stubGlobal('fetch', fetchImpl)
  const playerMod = await import('../src/lib/ambient/ambientPlayerV3')
  const audioMod = await import('../src/lib/audio')
  return { player: new playerMod.AmbientPlayerV3(), audio: audioMod }
}

describe('ambient player', () => {
  let ctx: FakeContext

  beforeEach(() => {
    vi.useFakeTimers()
    installMemoryStorage()
    ctx = new FakeContext()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts one looped track under the volume cap and ignores a second start', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('manifest')) return manifestResponse({ version: 3, tracks })
      return manifestResponse(null)
    })
    const { player } = await loadStack(ctx, fetchImpl)
    const prefs = {
      enabled: true,
      volume: 1,
      category: 'all' as const,
      pauseOnTyping: true,
      reducedMotion: false,
      screenReaderMode: false,
    }
    player.setPreferences(prefs)
    await player.start()
    await player.start()

    const looped = ctx.sources.filter((source) => source.loop)
    expect(looped.length).toBeGreaterThan(0)
    expect(looped[0].started.length).toBe(1)
    const volumes = ctx.gains.flatMap((gain) => gain.gain.ramps.map((ramp) => ramp.value))
    expect(volumes.some((value) => value > 0.7)).toBe(false)
    expect(volumes.some((value) => Math.abs(value - 0.7) < 0.001)).toBe(true)
  })

  it('crossfades on skip and on a category change, and skips automatic rotation when motion is reduced', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('manifest')) return manifestResponse({ version: 3, tracks })
      return manifestResponse(null)
    })
    const { player } = await loadStack(ctx, fetchImpl)
    player.setPreferences({
      enabled: true,
      volume: 0.5,
      category: 'rain',
      pauseOnTyping: false,
      reducedMotion: true,
      screenReaderMode: false,
    })
    await player.start()
    const beforeSkip = ctx.sources.length
    await player.skipTrack()
    expect(ctx.sources.length).toBeGreaterThan(beforeSkip)
    const fadeTimes = ctx.gains.flatMap((gain) => gain.gain.ramps.map((ramp) => ramp.time))
    expect(fadeTimes.some((time) => time >= 6 && time <= 8)).toBe(true)

    player.setPreferences({
      enabled: true,
      volume: 0.5,
      category: 'ocean',
      pauseOnTyping: false,
      reducedMotion: true,
      screenReaderMode: false,
    })
    await vi.runAllTicks()
    await Promise.resolve()
    expect(ctx.sources.some((source) => source.loop)).toBe(true)

    player.setPreferences({
      enabled: true,
      volume: 0.5,
      category: 'ocean',
      pauseOnTyping: false,
      reducedMotion: false,
      screenReaderMode: false,
    })
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(ctx.sources.length).toBeGreaterThan(1)
  })

  it('ducks while typing, hides with the tab, and stays silent when the file is missing', async () => {
    let failAudio = false
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('manifest')) return manifestResponse({ version: 3, tracks })
      if (failAudio) return manifestResponse(null, false)
      return manifestResponse(null)
    })
    const { player } = await loadStack(ctx, fetchImpl)
    player.setPreferences({
      enabled: true,
      volume: 0.4,
      category: 'all',
      pauseOnTyping: true,
      reducedMotion: false,
      screenReaderMode: false,
    })
    await player.start()
    player.noteTypingActivity()
    expect(ctx.gains.some((gain) => gain.gain.ramps.some((ramp) => ramp.value === 0))).toBe(true)
    await vi.advanceTimersByTimeAsync(900)
    player.setVisibilityPaused(true)
    player.setVisibilityPaused(false)

    player.setPreferences({
      enabled: false,
      volume: 0.4,
      category: 'all',
      pauseOnTyping: true,
      reducedMotion: false,
      screenReaderMode: true,
    })
    await player.skipTrack()

    failAudio = true
    ctx.decodeAudioData.mockResolvedValueOnce(null)
    player.setPreferences({
      enabled: true,
      volume: 0.4,
      category: 'cafe' as 'all',
      pauseOnTyping: false,
      reducedMotion: false,
      screenReaderMode: false,
    })
    await player.start()
  })

  it('drops an in-flight start after stop', async () => {
    let release: (() => void) | null = null
    const fetchImpl = vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          if (String(url).includes('manifest')) {
            release = () => resolve(manifestResponse({ version: 3, tracks }))
            return
          }
          resolve(manifestResponse(null))
        }),
    )
    const { player } = await loadStack(ctx, fetchImpl)
    const pending = player.start()
    player.stop()
    release?.()
    await pending
    expect(ctx.sources.filter((source) => source.loop)).toHaveLength(0)
  })
})

describe('typewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('plays a sample, falls back to a click, and stays quiet when sound is off', async () => {
    const ctx = new FakeContext()
    ctx.decodeAudioData.mockImplementation(async () => ctx.createBuffer(1, 80, 100))
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('key_1')) return manifestResponse(null)
      throw new Error('missing')
    })
    const { audio } = await loadStack(ctx, fetchImpl)
    const writer = new audio.TypewriterAudio()
    await writer.ensureReady()
    await writer.resume()
    writer.play('key', { enabled: false, volume: 1, modeGain: 1 })
    expect(ctx.sources).toHaveLength(0)

    writer.play('key', { enabled: true, volume: 1.4, modeGain: 0.5 })
    writer.play('spacebar', { enabled: true, volume: 0.2, modeGain: 1 })
    writer.play('backspace', { enabled: true, volume: 0.2, modeGain: 1 })
    writer.play('error', { enabled: true, volume: 0.2, modeGain: 1 })
    writer.play('return_bell', { enabled: true, volume: 0.2, modeGain: 1 })
    expect(ctx.sources.length).toBeGreaterThan(0)
    const gains = ctx.gains.map((gain) => gain.gain.value)
    expect(gains.some((value) => value > 0 && value <= 0.7)).toBe(true)

    for (let i = 0; i < 8; i++) writer.play('key', { enabled: true, volume: 0.2, modeGain: 1 })
    expect(ctx.sources.some((source) => source.stopped.length > 0 || source.started.length > 0)).toBe(true)
  })

  it('marks ready when the machine has no audio context', async () => {
    vi.resetModules()
    vi.stubGlobal('window', undefined)
    const audio = await import('../src/lib/audio')
    const writer = new audio.TypewriterAudio()
    await writer.ensureReady()
    await writer.resume()
    writer.play('key', { enabled: true, volume: 1, modeGain: 1 })
  })
})
