// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

type FailMode = 'ok' | 'throw' | 'status' | 'decode' | 'body'

class FakeParam {
  value = 1
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value
  }
  linearRampToValueAtTime(value: number) {
    this.value = value
  }
}

class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  readonly duration: number
  url = ''
  private readonly channels: Float32Array[]

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
    this.duration = length / sampleRate
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  getChannelData(channel: number) {
    const data = this.channels[channel]
    if (!data) throw new Error(`missing channel ${channel}`)
    return data
  }
}

class FakeSource {
  buffer: FakeBuffer | null = null
  playbackRate = new FakeParam()
  onended: (() => void) | null = null
  startArgs: { when: number; offset?: number } | null = null
  stopCount = 0
  failStop = false
  failDisconnect = false
  outputs: unknown[] = []

  connect(dest: unknown) {
    this.outputs.push(dest)
  }

  disconnect() {
    if (this.failDisconnect) throw new Error('already released')
  }

  start(when = 0, offset?: number) {
    this.startArgs = { when, offset }
  }

  stop() {
    this.stopCount += 1
    if (this.failStop) throw new Error('already ended')
  }
}

class FakeGain {
  gain = new FakeParam()
  outputs: unknown[] = []
  failDisconnect = false

  connect(dest: unknown) {
    this.outputs.push(dest)
  }

  disconnect() {
    if (this.failDisconnect) throw new Error('already released')
  }
}

class FakeAudioContext {
  static contexts: FakeAudioContext[] = []
  static resumeMode: 'ok' | 'throw' = 'ok'

  state: AudioContextState = 'suspended'
  currentTime = 0
  sampleRate = 44100
  destination = { name: 'destination' }
  resumeCalls = 0
  sources: FakeSource[] = []
  gains: FakeGain[] = []
  decoded: FakeBuffer[] = []
  created: FakeBuffer[] = []

  constructor() {
    FakeAudioContext.contexts.push(this)
  }

  async resume() {
    this.resumeCalls += 1
    if (FakeAudioContext.resumeMode === 'throw') throw new Error('resume failed')
    this.state = 'running'
  }

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeBuffer(channels, length, sampleRate)
    this.created.push(buffer)
    return buffer
  }

  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }

  async decodeAudioData(bytes: ArrayBuffer) {
    const url = bytesForUrl.get(bytes) ?? ''
    if (classify(url) === 'decode') throw new Error('decode failed')
    const buffer = new FakeBuffer(1, 44100, 44100)
    buffer.url = url
    const data = buffer.getChannelData(0)
    if (url.endsWith('audio/key_1.wav')) data[data.length - 1] = 1
    else data[0] = 1
    this.decoded.push(buffer)
    return buffer
  }
}

const bytesForUrl = new WeakMap<ArrayBuffer, string>()
let classify: (url: string) => FailMode = () => 'ok'

function responseFor(url: string, mode: FailMode) {
  const bytes = new ArrayBuffer(8)
  bytesForUrl.set(bytes, url)
  if (mode === 'throw') throw new Error('fetch failed')
  if (mode === 'body') {
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => {
        throw new Error('body failed')
      },
    }
  }
  return {
    ok: mode !== 'status',
    status: mode === 'status' ? 404 : 200,
    json: async () => ({}),
    arrayBuffer: async () => bytes,
  }
}

async function load(options?: { context?: boolean }) {
  vi.resetModules()
  FakeAudioContext.contexts = []
  FakeAudioContext.resumeMode = 'ok'
  const contextOn = options?.context !== false
  const ctor = contextOn ? FakeAudioContext : undefined
  vi.stubGlobal('AudioContext', ctor)
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: ctor })
  Object.defineProperty(window, 'webkitAudioContext', { configurable: true, writable: true, value: undefined })
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    return Promise.resolve(responseFor(url, classify(url)))
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const mod = await import('../src/lib/audio')
  return { mod, audio: new mod.TypewriterAudio(), fetchMock }
}

function ctx() {
  const created = FakeAudioContext.contexts[0]
  if (!created) throw new Error('expected an AudioContext')
  return created
}

async function drain() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

const sound = (over: Partial<{ enabled: boolean; volume: number; modeGain: number; keyboardVoice: string }> = {}) => ({
  enabled: true,
  volume: 1,
  modeGain: 1,
  ...over,
})

describe('TypewriterAudio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    classify = () => 'ok'
  })

  it('loads every sample, applies volume and mode gain, and resumes the context', async () => {
    const { mod, audio, fetchMock } = await load()
    expect(mod.typewriterAudio).toBeInstanceOf(mod.TypewriterAudio)

    await audio.ensureReady()
    await audio.ensureReady()
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls).toHaveLength(8)
    for (const name of ['key_1.wav', 'key_2.wav', 'key_3.wav', 'key_4.wav', 'spacebar.wav', 'backspace.wav', 'return_bell.wav', 'error.wav']) {
      expect(urls.some((url) => url.endsWith(`audio/${name}`))).toBe(true)
    }

    await audio.resume()
    expect(ctx().resumeCalls).toBe(1)
    expect(ctx().state).toBe('running')
    await audio.resume()
    expect(ctx().resumeCalls).toBe(1)

    audio.play('key', sound())
    audio.play('spacebar', sound({ volume: 0.5, modeGain: 0.4 }))
    audio.play('backspace', sound({ volume: 2, modeGain: 0.25 }))
    audio.play('return_bell', sound({ volume: -1, modeGain: 4 }))
    audio.play('error', sound({ volume: 0.25, modeGain: 0 }))

    const context = ctx()
    expect(context.sources).toHaveLength(5)
    expect(context.created).toHaveLength(0)
    expect(context.resumeCalls).toBe(1)
    expect(context.sources[0]?.buffer?.length).toBe(44100)
    expect(context.sources[0]?.buffer?.url.endsWith('audio/key_3.wav')).toBe(true)
    expect(context.sources[0]?.startArgs?.offset).toBe(0)
    expect(context.sources[0]?.playbackRate.value).toBe(1)
    expect(context.sources[1]?.startArgs?.offset).toBe(0)
    expect(context.gains[0]?.gain.value).toBeCloseTo(1, 5)
    expect(context.gains[1]?.gain.value).toBeCloseTo(0.2, 5)
    expect(context.gains[2]?.gain.value).toBeCloseTo(0.25, 5)
    expect(context.gains[3]?.gain.value).toBeCloseTo(0, 5)
    expect(context.gains[4]?.gain.value).toBeCloseTo(0, 5)
    expect(context.gains[0]?.outputs[0]).toBe(context.destination)
    expect(context.sources.every((source) => source.buffer && context.decoded.includes(source.buffer))).toBe(true)
  })

  it('plays nothing while disabled', async () => {
    const { audio } = await load()
    audio.play('key', sound({ enabled: false }))
    expect(FakeAudioContext.contexts).toHaveLength(0)

    await audio.ensureReady()
    audio.play('error', sound({ enabled: false }))
    expect(ctx().sources).toHaveLength(0)
  })

  it('marks ready when the context is missing, then synthesizes if a context appears later', async () => {
    const { audio, fetchMock } = await load({ context: false })
    await audio.ensureReady()
    await audio.ensureReady()
    await expect(audio.resume()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(FakeAudioContext.contexts).toHaveLength(0)

    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: FakeAudioContext })
    await audio.ensureReady()
    expect(fetchMock).not.toHaveBeenCalled()
    audio.play('key', sound())
    audio.play('return_bell', sound())
    expect(ctx().created.map((buffer) => buffer.length)).toEqual([
      Math.floor(44100 * 0.03),
      Math.floor(44100 * 0.12),
    ])
    expect(ctx().sources[0]?.startArgs?.offset).toBeUndefined()
  })

  it.each(['throw', 'status', 'decode', 'body'] as const)(
    'a failed %s falls back to synthesis without throwing',
    async (mode) => {
      classify = () => mode
      const { audio, fetchMock } = await load()
      await expect(audio.ensureReady()).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(8)
      await audio.ensureReady()
      expect(fetchMock).toHaveBeenCalledTimes(8)

      audio.play('key', sound())
      audio.play('spacebar', sound())
      audio.play('backspace', sound())
      audio.play('error', sound())
      audio.play('return_bell', sound())

      const created = ctx().created
      expect(created).toHaveLength(5)
      for (const buffer of created.slice(0, 4)) expect(buffer.length).toBe(Math.floor(44100 * 0.03))
      expect(created[4]?.length).toBe(Math.floor(44100 * 0.12))
      expect(created[0]?.getChannelData(0)[0]).toBeCloseTo(-1, 5)
      expect(created[4]?.getChannelData(0)[0]).toBe(0)
      expect(created[4]?.getChannelData(0)[10]).not.toBe(0)
      expect(ctx().sources.every((source) => source.startArgs?.offset === undefined)).toBe(true)
    },
  )

  it('locks a keyboard to one recording and synthesizes only when that file is missing', async () => {
    classify = (url) => (url.endsWith('audio/key_3.wav') || url.endsWith('audio/key_1.wav') || url.endsWith('audio/spacebar.wav') ? 'ok' : 'status')
    const { audio } = await load()
    await audio.ensureReady()

    audio.play('key', sound())
    audio.play('key', sound())
    const mechanical = ctx().sources[0]?.buffer
    expect(mechanical?.url.endsWith('audio/key_3.wav')).toBe(true)
    expect(ctx().sources[1]?.buffer).toBe(mechanical)
    expect(ctx().sources[0]?.playbackRate.value).toBe(1)
    expect(ctx().sources[1]?.playbackRate.value).toBe(1)
    expect(ctx().created).toHaveLength(0)

    audio.play('key', sound({ keyboardVoice: 'tick' }))
    expect(ctx().sources[2]?.buffer?.url.endsWith('audio/key_1.wav')).toBe(true)
    expect(ctx().sources[2]?.startArgs?.offset).toBeCloseTo(0.98, 5)
    expect(ctx().sources[2]?.playbackRate.value).toBe(1)

    audio.play('key', sound({ keyboardVoice: 'clicky' }))
    audio.play('key', sound({ keyboardVoice: 'muted' }))
    audio.play('key', sound({ keyboardVoice: 'electric' }))
    expect(ctx().created).toHaveLength(2)
    expect(ctx().created[0]?.length).toBe(Math.floor(44100 * 0.03))
    expect(ctx().created[1]?.length).toBe(Math.floor(44100 * 0.03))
    expect(ctx().sources[5]?.buffer).toBe(mechanical)
    expect(ctx().created).toHaveLength(2)
  })

  it('shares one preload when ensureReady overlaps', async () => {
    const { audio } = await load()
    const resolvers: Array<(value: unknown) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          }),
      ),
    )
    const first = audio.ensureReady()
    const second = audio.ensureReady()
    expect(resolvers).toHaveLength(8)
    for (const resolve of resolvers) resolve(responseFor('audio/missing.wav', 'status'))
    await Promise.all([first, second])
    await audio.ensureReady()
    expect(resolvers).toHaveLength(8)
    audio.play('backspace', sound())
    expect(ctx().created).toHaveLength(1)
  })

  it('asks a suspended context to resume and swallows a rejection', async () => {
    const { audio } = await load()
    await audio.ensureReady()
    expect(ctx().state).toBe('suspended')
    FakeAudioContext.resumeMode = 'throw'
    audio.play('spacebar', sound())
    await drain()
    expect(ctx().resumeCalls).toBe(1)
    expect(ctx().sources).toHaveLength(1)
  })

  it('caps polyphony at six and drops voices whose stop time has passed', async () => {
    const { audio } = await load()
    for (let i = 0; i < 6; i += 1) audio.play('key', sound())
    expect(ctx().sources.every((source) => source.stopCount === 0)).toBe(true)

    ctx().currentTime = 100
    for (let i = 0; i < 6; i += 1) audio.play('key', sound())
    expect(ctx().sources.every((source) => source.stopCount === 0)).toBe(true)

    audio.play('key', sound())
    const stopped = ctx().sources.filter((source) => source.stopCount > 0)
    expect(stopped).toHaveLength(1)
    expect(ctx().sources[6]?.stopCount).toBe(1)
  })

  it('swallows stop and disconnect failures when a voice is cut or ends', async () => {
    const { audio } = await load()
    for (let i = 0; i < 6; i += 1) audio.play('error', sound())
    const oldest = ctx().sources[0]
    if (!oldest) throw new Error('missing voice')
    oldest.failStop = true
    oldest.failDisconnect = true
    audio.play('error', sound())
    expect(oldest.stopCount).toBe(1)
    oldest.onended?.()
    const other = ctx().sources[1]
    if (!other?.onended) throw new Error('missing onended')
    other.failDisconnect = true
    other.onended()
  })
})
