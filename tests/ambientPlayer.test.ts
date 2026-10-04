// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AmbientCategory, AmbientTrack } from '../src/lib/ambientManifest'
import type { AmbientPrefs } from '../src/lib/ambient/ambientPlayerV3'

type AudioFail = 'ok' | 'throw' | 'status' | 'decode' | 'body'
type Shape = { channels: number; length: number; sampleRate: number }

class FakeParam {
  value = 0
  events: Array<{ type: 'cancel' | 'set' | 'ramp'; value?: number; time: number }> = []

  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time })
  }

  setValueAtTime(value: number, time: number) {
    this.events.push({ type: 'set', value, time })
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'ramp', value, time })
  }
}

class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  private readonly channels: Float32Array[]

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  get duration() {
    return this.length / this.sampleRate
  }

  getChannelData(channel: number) {
    const data = this.channels[channel]
    if (!data) throw new Error(`missing channel ${channel}`)
    return data
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
    if (this.failDisconnect) throw new Error('already stopped')
  }
}

class FakeCompressor {
  threshold = new FakeParam()
  knee = new FakeParam()
  ratio = new FakeParam()
  attack = new FakeParam()
  release = new FakeParam()
  outputs: unknown[] = []

  connect(dest: unknown) {
    this.outputs.push(dest)
  }

  disconnect() {}
}

class FakeSource {
  buffer: FakeBuffer | null = null
  loop = false
  onended: (() => void) | null = null
  outputs: unknown[] = []
  startArgs: { when: number; offset?: number } | null = null
  stopArgs: { when: number } | null = null
  stopCount = 0
  failStop = false
  failDisconnect = false

  connect(dest: unknown) {
    this.outputs.push(dest)
  }

  disconnect() {
    if (this.failDisconnect) throw new Error('already stopped')
  }

  start(when = 0, offset = 0) {
    if (controls.failStartOnce) {
      controls.failStartOnce = false
      throw new Error('start failed')
    }
    controls.beforeStart?.()
    this.startArgs = { when, offset }
  }

  stop(when = 0) {
    this.stopCount += 1
    this.stopArgs = { when }
    if (this.failStop) throw new Error('stop failed')
  }
}

class FakeAudioContext {
  static contexts: FakeAudioContext[] = []
  static resumeMode: 'ok' | 'throw' = 'ok'
  static pendingResume: Promise<void> | null = null

  state: AudioContextState = 'suspended'
  currentTime = 0
  sampleRate = 48000
  destination = { name: 'destination' }
  resumeCalls = 0
  sources: FakeSource[] = []
  gains: FakeGain[] = []
  compressors: FakeCompressor[] = []
  decoded: FakeBuffer[] = []
  created: FakeBuffer[] = []

  constructor() {
    FakeAudioContext.contexts.push(this)
  }

  async resume() {
    this.resumeCalls += 1
    if (FakeAudioContext.resumeMode === 'throw') throw new Error('resume failed')
    if (FakeAudioContext.pendingResume) await FakeAudioContext.pendingResume
    this.state = 'running'
  }

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  createDynamicsCompressor() {
    const limiter = new FakeCompressor()
    this.compressors.push(limiter)
    return limiter
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
    const url = bytesForUrl.get(bytes)
    if (!url) throw new Error('missing audio bytes')
    if (controls.failAudio === 'decode' || controls.decodeFail(url)) throw new Error('decode failed')
    const shape = controls.shapes.get(url) ?? { channels: 2, length: 48000 * 3, sampleRate: 48000 }
    const buffer = new FakeBuffer(shape.channels, shape.length, shape.sampleRate)
    const marker = markerFor(url)
    for (let channel = 0; channel < shape.channels; channel += 1) {
      buffer.getChannelData(channel).fill(marker / (channel + 1))
    }
    this.decoded.push(buffer)
    controls.afterDecode?.()
    return buffer
  }
}

type ManifestMode = 'ok' | 'throw' | 'status' | 'bad' | 'defer'

type Controls = {
  tracks: AmbientTrack[]
  manifestMode: ManifestMode
  manifestWaiters: Array<() => void>
  deferAudio: (url: string) => boolean
  audioWaiters: Array<{ url: string; resolve: (value: unknown) => void }>
  failAudio: AudioFail
  decodeFail: (url: string) => boolean
  shapes: Map<string, Shape>
  fetched: string[]
  beforeStart?: () => void
  afterDecode?: () => void
  failStartOnce: boolean
}

const bytesForUrl = new WeakMap<ArrayBuffer, string>()
const markers = new Map<string, number>()
let nextMarker = 1
let controls: Controls

function markerFor(url: string) {
  const existing = markers.get(url)
  if (existing != null) return existing
  const value = nextMarker
  nextMarker += 1
  markers.set(url, value)
  return value
}

function makeTrack(
  id: string,
  category: AmbientCategory,
  path = `/audio/ambient/${id}.wav`,
  durationSec = 180,
): AmbientTrack {
  return { id, title: id, category, tags: ['soft'], path, duration_sec: durationSec }
}

function resolved(path: string) {
  return path.startsWith('/') ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path
}

function resetControls() {
  markers.clear()
  nextMarker = 1
  controls = {
    tracks: [makeTrack('rain-a', 'rain'), makeTrack('rain-b', 'rain'), makeTrack('ocean-a', 'ocean')],
    manifestMode: 'ok',
    manifestWaiters: [],
    deferAudio: () => false,
    audioWaiters: [],
    failAudio: 'ok',
    decodeFail: () => false,
    shapes: new Map(),
    fetched: [],
    failStartOnce: false,
  }
}

resetControls()

function http(ok: boolean, jsonBody: unknown, url = '') {
  const bytes = new ArrayBuffer(8)
  if (url) bytesForUrl.set(bytes, url)
  return {
    ok,
    status: ok ? 200 : 404,
    json: async () => jsonBody,
    arrayBuffer: async () => bytes,
  }
}

function manifestBody() {
  return { version: 3, tracks: controls.tracks }
}

function audioResponse(url: string) {
  const mode = controls.failAudio
  if (mode === 'throw') throw new Error('network')
  if (controls.deferAudio(url)) {
    return new Promise((resolve) => {
      controls.audioWaiters.push({ url, resolve })
    })
  }
  if (mode === 'status') return http(false, {}, url)
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
  return http(true, {}, url)
}

function manifestResponse() {
  if (controls.manifestMode === 'throw') throw new Error('manifest down')
  if (controls.manifestMode === 'status') return http(false, {})
  if (controls.manifestMode === 'bad') return http(true, { version: 'nope', tracks: [] })
  if (controls.manifestMode === 'defer') {
    return new Promise((resolve) => {
      controls.manifestWaiters.push(() => resolve(http(true, manifestBody())))
    })
  }
  return http(true, manifestBody())
}

async function fetchImpl(input: RequestInfo | URL) {
  const url = String(input)
  controls.fetched.push(url)
  if (url.includes('manifest.json')) return manifestResponse()
  return audioResponse(url)
}

function prefs(over: Partial<AmbientPrefs> = {}): AmbientPrefs {
  return {
    enabled: true,
    volume: 0.5,
    category: 'all',
    pauseOnTyping: false,
    reducedMotion: false,
    screenReaderMode: false,
    ...over,
  }
}

const opened: Array<{ stop: () => void }> = []

function closeOpened() {
  const batch = opened.splice(0)
  for (const player of batch) player.stop()
}

async function boot(options?: { context?: boolean }) {
  closeOpened()
  vi.resetModules()
  resetControls()
  FakeAudioContext.contexts = []
  FakeAudioContext.resumeMode = 'ok'
  FakeAudioContext.pendingResume = null
  const ctor = options?.context === false ? undefined : FakeAudioContext
  vi.stubGlobal('AudioContext', ctor)
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: ctor })
  Object.defineProperty(window, 'webkitAudioContext', { configurable: true, writable: true, value: undefined })
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const { AmbientPlayerV3 } = await import('../src/lib/ambient/ambientPlayerV3')
  const player = new AmbientPlayerV3()
  opened.push(player)
  return { player, random }
}

function context() {
  const created = FakeAudioContext.contexts[0]
  if (!created) throw new Error('expected an AudioContext')
  return created
}

function master() {
  const dest = context().destination
  const direct = context().gains.find((item) => item.outputs.includes(dest))
  if (direct) return direct
  const limiter = context().compressors.find((item) => item.outputs.includes(dest))
  const via = limiter && context().gains.find((item) => item.outputs.includes(limiter))
  if (!via) throw new Error('expected a master gain')
  return via
}

function liveSources() {
  return context().sources.filter((source) => source.startArgs && !source.stopArgs)
}

function stampOf(source: FakeSource) {
  const data = source.buffer?.getChannelData(0)
  if (!data) return null
  return data[Math.floor(data.length / 2)]
}

function lastRamp(param: FakeParam) {
  let rampAt = -1
  for (let i = param.events.length - 1; i >= 0; i -= 1) {
    if (param.events[i]?.type === 'ramp') {
      rampAt = i
      break
    }
  }
  const ramp = param.events[rampAt]
  if (!ramp) throw new Error('expected a ramp')
  let setTime = ramp.time
  for (let i = rampAt; i >= 0; i -= 1) {
    const event = param.events[i]
    if (event?.type === 'set') {
      setTime = event.time
      break
    }
  }
  return { value: ramp.value ?? 0, duration: ramp.time - setTime }
}

function assertMasterCapped() {
  for (const event of master().gain.events) {
    if (event.value != null) expect(event.value).toBeLessThanOrEqual(4 + 1e-9)
  }
}

function assertWholeTrack(source: FakeSource) {
  expect(source.loop).toBe(true)
  expect(source.outputs).toHaveLength(1)
  const gain = source.outputs[0] as FakeGain
  expect(gain.outputs).toEqual([master()])
}

async function drain() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve()
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 80; i += 1) {
    if (predicate()) return
    await Promise.resolve()
  }
  throw new Error('timed out waiting for audio work')
}

function resolveAudio() {
  const waiting = controls.audioWaiters.splice(0)
  for (const waiter of waiting) waiter.resolve(http(true, {}, waiter.url))
}

function useClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
}

function manifestFetches() {
  return controls.fetched.filter((url) => url.includes('manifest.json')).length
}

function audioFetches() {
  return controls.fetched.filter((url) => !url.includes('manifest.json')).length
}

describe('AmbientPlayerV3', () => {
  afterEach(() => {
    closeOpened()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    FakeAudioContext.pendingResume = null
    FakeAudioContext.resumeMode = 'ok'
  })

  it('lifts a full slider to the playback gain and keeps the midpoint at half', async () => {
    const { player } = await boot()
    const cases: Array<[number, number]> = [
      [1, 4],
      [2, 4],
      [0.5, 2],
      [0, 0],
      [-4, 0],
    ]
    for (const [volume, expected] of cases) {
      player.setPreferences(prefs({ volume }))
      expect(lastRamp(master().gain).value).toBeCloseTo(expected, 5)
    }
    const limiter = context().compressors[0]
    expect(limiter?.threshold.value).toBeCloseTo(-1.5, 5)
    expect(master().outputs).toContain(limiter)
    expect(limiter?.outputs).toContain(context().destination)
    await player.start()
    expect(lastRamp(master().gain).value).toBeCloseTo(0, 5)
    player.setPreferences(prefs({ volume: 1 }))
    expect(lastRamp(master().gain).value).toBeCloseTo(4, 5)
    expect(liveSources()).toHaveLength(1)
    assertWholeTrack(liveSources()[0]!)
    expect(liveSources()[0]?.buffer).not.toBe(context().decoded[0])
    expect(context().created.length).toBeGreaterThan(0)
    assertMasterCapped()
  })

  it('crossfades one whole track for 6 to 8 seconds and does not leave a second layer playing', async () => {
    const { player, random } = await boot()
    player.setPreferences(prefs({ volume: 1 }))
    await player.start()
    await drain()
    const first = context().sources[0]
    if (!first) throw new Error('missing first track')

    await player.skipTrack()
    const faded = lastRamp((context().sources[1]?.outputs[0] as FakeGain).gain)
    const fadedOut = lastRamp((first.outputs[0] as FakeGain).gain)
    expect(faded.value).toBe(1)
    expect(faded.duration).toBeCloseTo(6, 5)
    expect(faded.duration).toBeGreaterThanOrEqual(6)
    expect(faded.duration).toBeLessThanOrEqual(8)
    expect(fadedOut.value).toBe(0)
    expect(fadedOut.duration).toBeCloseTo(6, 5)
    expect(first.stopArgs?.when).toBeCloseTo(6.2, 5)
    expect(liveSources()).toHaveLength(1)
    expect(context().sources).toHaveLength(2)
    assertWholeTrack(liveSources()[0]!)
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/rain-b.wav')))
    assertMasterCapped()

    const queue = [0, 0, 1, 0, 0]
    random.mockImplementation(() => queue.shift() ?? 0)
    const before = context().sources.length
    await player.skipTrack()
    const newest = context().sources.at(-1)
    if (!newest) throw new Error('missing crossfade target')
    const longFade = lastRamp((newest.outputs[0] as FakeGain).gain)
    expect(longFade.duration).toBeCloseTo(8, 5)
    expect(longFade.duration).toBeLessThanOrEqual(8)
    expect(context().sources.length).toBe(before + 1)
    expect(liveSources()).toHaveLength(1)
    assertWholeTrack(liveSources()[0]!)
    assertMasterCapped()
  })

  it('waits five minutes before an automatic crossfade when the roll is zero', async () => {
    useClock()
    const { player } = await boot()
    await player.start()
    await drain()
    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1)
    await drain()
    expect(context().sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await drain()
    expect(context().sources).toHaveLength(2)
    expect(liveSources()).toHaveLength(1)
    expect(liveSources()[0]?.loop).toBe(true)
  })

  it('waits the full ten minutes when the rotation roll is at the top of the range', async () => {
    useClock()
    const { player, random } = await boot()
    let call = 0
    random.mockImplementation(() => (++call === 4 ? 1 : 0))
    await player.start()
    await drain()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(2)
    expect(liveSources()).toHaveLength(1)
  })

  it('hears a short bed once, then crossfades', async () => {
    useClock()
    const { player } = await boot()
    controls.tracks = [
      makeTrack('short-a', 'rain', '/audio/ambient/short-a.wav', 40),
      makeTrack('short-b', 'rain', '/audio/ambient/short-b.wav', 45),
    ]
    await player.start()
    await drain()
    expect(context().sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(32_000 - 1)
    await drain()
    expect(context().sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await drain()
    expect(context().sources).toHaveLength(2)
  })

  it('starts a reduced-motion visit on a long bed when the catalog has one', async () => {
    const { player } = await boot()
    controls.tracks = [
      makeTrack('short-loop', 'ocean', '/audio/ambient/short-loop.wav', 45),
      makeTrack('long-bed', 'ocean', '/audio/ambient/long-bed.wav', 180),
    ]
    player.setPreferences(prefs({ reducedMotion: true, volume: 0.5 }))
    await player.start()
    await drain()
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/long-bed.wav')))
  })

  it('skips automatic rotation while reduced motion is on, but still crossfades once for skip and category', async () => {
    useClock()
    const { player } = await boot()
    player.setPreferences(prefs({ reducedMotion: true, volume: 0.5 }))
    await player.start()
    await drain()
    expect(context().sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(1)

    await player.skipTrack()
    expect(context().sources).toHaveLength(2)
    expect(liveSources()).toHaveLength(1)
    expect(liveSources()[0]?.loop).toBe(true)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(2)

    player.setPreferences(prefs({ reducedMotion: true, category: 'ocean', volume: 0.5 }))
    await drain()
    expect(context().sources).toHaveLength(3)
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/ocean-a.wav')))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(3)
  })

  it('clears a live rotation timer when reduced motion turns on, and arms it again when motion turns off', async () => {
    useClock()
    const { player } = await boot()
    await player.start()
    await drain()
    player.setPreferences(prefs({ reducedMotion: true }))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(1)

    player.setPreferences(prefs({ reducedMotion: false }))
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(2)
  })

  it('ducks while typing and restores the slider volume after a fixed idle, not on the key gaps', async () => {
    useClock()
    const { player } = await boot()
    player.setPreferences(prefs({ pauseOnTyping: true, volume: 0.5 }))
    await player.start()
    const source = liveSources()[0]
    const eventsBefore = master().gain.events.length
    player.noteTypingActivity()
    await vi.advanceTimersByTimeAsync(100)
    player.noteTypingActivity()
    await vi.advanceTimersByTimeAsync(200)
    player.noteTypingActivity()
    const ducked = master().gain.events.slice(eventsBefore).filter((event) => event.type === 'ramp')
    expect(ducked.length).toBeGreaterThan(0)
    for (const event of ducked) {
      expect(event.value).toBe(0)
      expect((event.time ?? 0) - 0).toBeCloseTo(0.12, 5)
    }
    await vi.advanceTimersByTimeAsync(899)
    expect(master().gain.events.filter((event) => event.type === 'ramp' && event.value !== 0).length).toBe(
      master().gain.events.slice(0, eventsBefore).filter((event) => event.type === 'ramp' && event.value !== 0).length,
    )
    await vi.advanceTimersByTimeAsync(1)
    const restored = lastRamp(master().gain)
    expect(restored.value).toBeCloseTo(2, 5)
    expect(restored.duration).toBeCloseTo(0.6, 5)
    expect(source?.stopCount).toBe(0)
    assertMasterCapped()
  })

  it('does not duck when pause-on-typing is off, and stop cancels a pending restore', async () => {
    useClock()
    const { player } = await boot()
    await player.start()
    const before = master().gain.events.length
    player.noteTypingActivity()
    expect(master().gain.events.length).toBe(before)

    player.setPreferences(prefs({ pauseOnTyping: true, volume: 1 }))
    player.noteTypingActivity()
    player.stop()
    const afterStop = master().gain.events.length
    await vi.advanceTimersByTimeAsync(1_000)
    expect(master().gain.events.length).toBe(afterStop)
  })

  it('does not restore the duck while the tab is hidden', async () => {
    useClock()
    const { player } = await boot()
    player.setPreferences(prefs({ pauseOnTyping: true, volume: 1 }))
    await player.start()
    player.noteTypingActivity()
    player.setVisibilityPaused(true)
    const hiddenEvents = master().gain.events.length
    await vi.advanceTimersByTimeAsync(900)
    expect(master().gain.events.length).toBe(hiddenEvents)
    expect(liveSources()[0]?.stopCount).toBe(0)
    player.setVisibilityPaused(false)
    expect(lastRamp(master().gain).value).toBeCloseTo(4, 5)
    expect(lastRamp(master().gain).duration).toBeCloseTo(0.8, 5)
    assertMasterCapped()
  })

  it('forces silence in screen-reader mode, including a load that is already in flight', async () => {
    const { player } = await boot()
    player.setPreferences(prefs({ volume: 1, screenReaderMode: true }))
    await player.start()
    expect(player.isStarted()).toBe(true)
    expect(FakeAudioContext.contexts[0]?.sources ?? []).toHaveLength(0)
    expect(lastRamp(master().gain).value).toBe(0)
    await player.start()
    expect(context().sources).toHaveLength(0)

    player.setPreferences(prefs({ volume: 1, screenReaderMode: false }))
    await drain()
    expect(liveSources()).toHaveLength(1)
    expect(liveSources()[0]?.loop).toBe(true)
    assertMasterCapped()

    const inflight = await boot()
    controls.deferAudio = () => true
    const pending = inflight.player.start()
    await until(() => controls.audioWaiters.length > 0)
    inflight.player.setPreferences(prefs({ volume: 1, screenReaderMode: true }))
    resolveAudio()
    await pending
    await drain()
    expect(context().sources.filter((source) => source.startArgs)).toHaveLength(0)
    expect(lastRamp(master().gain).value).toBe(0)
  })

  it('fades out when ambient is switched off and can start again when it is switched on', async () => {
    const { player } = await boot()
    await player.start()
    expect(liveSources()).toHaveLength(1)
    player.setPreferences(prefs({ enabled: false, volume: 1 }))
    expect(liveSources()).toHaveLength(0)
    await player.skipTrack()
    expect(context().sources).toHaveLength(1)
    player.setPreferences(prefs({ enabled: true, volume: 1 }))
    await drain()
    expect(liveSources()).toHaveLength(1)
    expect(liveSources()[0]?.loop).toBe(true)
    assertMasterCapped()
  })

  it.each(['throw', 'status', 'bad'] as const)('stays silent when the manifest %s', async (mode) => {
    const { player } = await boot()
    controls.manifestMode = mode
    await expect(player.start()).resolves.toBeUndefined()
    expect(context().sources).toHaveLength(0)
    expect(player.isStarted()).toBe(false)
    await player.start()
    expect(context().sources).toHaveLength(0)
    expect(player.isStarted()).toBe(false)
    expect(manifestFetches()).toBeGreaterThan(1)
  })

  it('stays silent when the manifest has no tracks', async () => {
    const { player } = await boot()
    controls.tracks = []
    await expect(player.start()).resolves.toBeUndefined()
    expect(context().sources).toHaveLength(0)
    expect(player.isStarted()).toBe(false)
  })

  it.each(['throw', 'status', 'decode', 'body'] as const)(
    'stays silent when a track %s and does not throw',
    async (mode) => {
      const { player } = await boot()
      controls.failAudio = mode
      await expect(player.start()).resolves.toBeUndefined()
      expect(context().sources.filter((source) => source.startArgs)).toHaveLength(0)
      const fetches = controls.fetched.length
      await player.start()
      expect(controls.fetched.length).toBeGreaterThan(fetches)
      expect(player.isStarted()).toBe(false)
    },
  )

  it('ignores a second start while the first is still loading the manifest', async () => {
    const { player } = await boot()
    controls.manifestMode = 'defer'
    const first = player.start()
    await until(() => controls.manifestWaiters.length > 0)
    const second = player.start()
    await second
    expect(player.isStarted()).toBe(false)
    expect(context().sources).toHaveLength(0)
    controls.manifestWaiters.shift()?.()
    await first
    await drain()
    expect(liveSources()).toHaveLength(1)
    expect(player.isStarted()).toBe(true)
  })

  it('keeps the last manifest when a later fetch fails and still crossfades', async () => {
    const { player } = await boot()
    let now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    await player.start()
    await drain()
    expect(player.isStarted()).toBe(true)
    expect(context().sources).toHaveLength(1)
    now += 60_000
    controls.manifestMode = 'throw'
    await player.skipTrack()
    await drain()
    expect(context().sources.length).toBeGreaterThan(1)
    expect(liveSources()).toHaveLength(1)
    expect(player.isStarted()).toBe(true)
  })

  it('does not cache a failed refresh of an empty catalog', async () => {
    const { player } = await boot()
    let now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    controls.tracks = []
    await player.start()
    expect(player.isStarted()).toBe(false)
    now += 60_000
    controls.manifestMode = 'throw'
    const fetches = manifestFetches()
    await player.start()
    expect(manifestFetches()).toBeGreaterThan(fetches)
    expect(player.isStarted()).toBe(false)
  })

  it('does not start twice after a successful start, and retries when resume itself fails', async () => {
    const { player } = await boot()
    FakeAudioContext.resumeMode = 'throw'
    await expect(player.start()).resolves.toBeUndefined()
    expect(FakeAudioContext.contexts[0]?.sources ?? []).toHaveLength(0)
    FakeAudioContext.resumeMode = 'ok'
    await player.start()
    const resumes = context().resumeCalls
    const sources = context().sources.length
    await player.start()
    expect(context().resumeCalls).toBe(resumes)
    expect(context().sources.length).toBe(sources)
  })

  it('drops an in-flight start when stop bumps the generation during resume, manifest, or decode', async () => {
    const resumed = await boot()
    let releaseResume: () => void = () => {}
    FakeAudioContext.pendingResume = new Promise((resolve) => {
      releaseResume = resolve
    })
    const duringResume = resumed.player.start()
    resumed.player.stop()
    FakeAudioContext.pendingResume = null
    releaseResume()
    await duringResume
    expect(context().sources).toHaveLength(0)
    await resumed.player.start()
    expect(liveSources()).toHaveLength(1)

    const manifested = await boot()
    controls.manifestMode = 'defer'
    const duringManifest = manifested.player.start()
    await until(() => controls.manifestWaiters.length > 0)
    manifested.player.stop()
    controls.manifestWaiters.shift()?.()
    await duringManifest
    expect(context().sources).toHaveLength(0)

    const decoded = await boot()
    controls.deferAudio = () => true
    const duringDecode = decoded.player.start()
    await until(() => controls.audioWaiters.length > 0)
    decoded.player.stop()
    resolveAudio()
    await duringDecode
    await drain()
    expect(context().sources.filter((source) => source.startArgs)).toHaveLength(0)
    controls.deferAudio = () => false
    await decoded.player.start()
    expect(liveSources()).toHaveLength(1)
  })

  it('does not let a preload that resolves after stop start a track', async () => {
    const { player } = await boot()
    let fetches = 0
    controls.deferAudio = () => ++fetches > 1
    await player.start()
    await until(() => controls.audioWaiters.length > 0)
    player.stop()
    resolveAudio()
    await drain()
    expect(context().sources.filter((source) => source.startArgs)).toHaveLength(1)
    expect(liveSources()).toHaveLength(0)
  })

  it('stops a slot that loses the generation race while it is being started', async () => {
    const { player } = await boot()
    controls.beforeStart = () => {
      controls.beforeStart = undefined
      player.stop()
    }
    await player.start()
    expect(liveSources()).toHaveLength(0)
    await player.start()
    expect(liveSources()).toHaveLength(1)
    expect(liveSources()[0]?.loop).toBe(true)
  })

  it('does not finish a crossfade that stop interrupts', async () => {
    const { player } = await boot()
    let seen = 0
    controls.beforeStart = () => {
      seen += 1
      if (seen === 2) {
        controls.beforeStart = undefined
        player.stop()
      }
    }
    await player.start()
    await player.skipTrack()
    expect(liveSources()).toHaveLength(0)
  })

  it('hides by fading the master, does not rotate while hidden, and can resume when shown', async () => {
    useClock()
    const { player } = await boot()
    player.setPreferences(prefs({ volume: 1 }))
    await player.start()
    await drain()
    const source = liveSources()[0]
    player.setVisibilityPaused(true)
    expect(source?.stopCount).toBe(0)
    expect(lastRamp(master().gain).value).toBe(0)
    expect(lastRamp(master().gain).duration).toBeCloseTo(0.6, 5)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await drain()
    expect(context().sources).toHaveLength(1)

    player.setVisibilityPaused(false)
    expect(source?.stopCount).toBe(0)
    expect(lastRamp(master().gain).value).toBeCloseTo(4, 5)
    expect(lastRamp(master().gain).duration).toBeCloseTo(0.8, 5)
    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1)
    await drain()
    expect(context().sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await drain()
    expect(context().sources).toHaveLength(2)
    expect(liveSources()).toHaveLength(1)
    assertMasterCapped()
  })

  it('does not start a crossfade that becomes hidden while the next buffer is decoding', async () => {
    const { player } = await boot()
    let now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    await player.start()
    await drain()
    now += 60_000
    controls.tracks = [makeTrack('fresh', 'rain', '/audio/ambient/fresh.wav')]
    controls.afterDecode = () => {
      controls.afterDecode = undefined
      player.setVisibilityPaused(true)
    }
    await player.skipTrack()
    expect(context().sources).toHaveLength(1)
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/rain-a.wav')))
    expect(liveSources()[0]?.loop).toBe(true)
  })

  it('plays the chosen category, and falls back to the full catalog when that category is empty', async () => {
    const { player } = await boot()
    player.setPreferences(prefs({ category: 'ocean' }))
    await player.start()
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/ocean-a.wav')))

    const fallback = await boot()
    fallback.player.setPreferences(prefs({ category: 'cafe' }))
    await fallback.player.start()
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/rain-a.wav')))
  })

  it('keeps a short loop buffer as-is and still loops it', async () => {
    const { player } = await boot()
    controls.tracks = [makeTrack('short', 'wind', '/audio/ambient/short.wav')]
    controls.shapes.set(resolved('/audio/ambient/short.wav'), { channels: 1, length: 16, sampleRate: 1 })
    await player.start()
    const source = liveSources()[0]
    expect(source?.buffer).toBe(context().decoded[0])
    expect(source?.loop).toBe(true)
    expect(context().created).toHaveLength(0)
  })

  it('fetches a rooted path from the app base and a relative path unchanged, then reuses the cache', async () => {
    const { player } = await boot()
    controls.tracks = [
      makeTrack('rel', 'wind', 'audio/ambient/rel.wav'),
      makeTrack('abs', 'wind', '/audio/ambient/abs.wav'),
    ]
    await player.start()
    await drain()
    expect(controls.fetched).toContain('audio/ambient/rel.wav')
    expect(controls.fetched).toContain(resolved('/audio/ambient/abs.wav'))
    const fetches = audioFetches()
    await player.skipTrack()
    await drain()
    await player.skipTrack()
    expect(audioFetches()).toBe(fetches)
    expect(liveSources()).toHaveLength(1)
    expect(liveSources()[0]?.loop).toBe(true)
  })

  it('ignores a track that was stored as recent and will replay the only track', async () => {
    const { player } = await boot()
    localStorage.setItem(
      'lkt_ambient_history_v3',
      JSON.stringify({ recentTracks: [{ id: 'rain-a', atMs: Date.now() }] }),
    )
    await player.start()
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/rain-b.wav')))

    const only = await boot()
    controls.tracks = [makeTrack('only', 'rain')]
    await only.player.start()
    await only.player.skipTrack()
    expect(liveSources()).toHaveLength(1)
    expect(stampOf(liveSources()[0]!)).toBe(markerFor(resolved('/audio/ambient/only.wav')))
    expect(context().sources).toHaveLength(2)
  })

  it('still plays when stored history is not json', async () => {
    const { player } = await boot()
    localStorage.setItem('lkt_ambient_history_v3', '{')
    await player.start()
    expect(liveSources()).toHaveLength(1)
  })

  it('reloads the manifest after a minute and does not crossfade when the new list is empty', async () => {
    const { player } = await boot()
    let now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    await player.start()
    await drain()
    expect(manifestFetches()).toBe(1)
    now += 59_999
    await player.skipTrack()
    await drain()
    expect(manifestFetches()).toBe(1)
    expect(context().sources).toHaveLength(2)
    now += 1
    controls.tracks = []
    await player.skipTrack()
    expect(manifestFetches()).toBe(2)
    expect(context().sources).toHaveLength(2)
    expect(liveSources()).toHaveLength(1)
  })

  it('schedules another rotation when the next buffer cannot be decoded', async () => {
    useClock()
    const { player } = await boot()
    controls.decodeFail = (url) => url.includes('rain-b') || url.includes('ocean-a')
    await player.start()
    await drain()
    expect(context().sources).toHaveLength(1)
    const fetchesAtStart = audioFetches()
    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1)
    await drain()
    expect(audioFetches()).toBe(fetchesAtStart)
    await player.skipTrack()
    await drain()
    expect(context().sources).toHaveLength(1)
    const fetchesAfterSkip = audioFetches()
    expect(fetchesAfterSkip).toBeGreaterThan(fetchesAtStart)
    await vi.advanceTimersByTimeAsync(2)
    await drain()
    expect(audioFetches()).toBe(fetchesAfterSkip)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await drain()
    expect(audioFetches()).toBeGreaterThan(fetchesAfterSkip)
    expect(liveSources()).toHaveLength(1)
  })

  it('swallows a failed start, a failed stop, and a disconnect from onended', async () => {
    const { player } = await boot()
    controls.failStartOnce = true
    await expect(player.start()).resolves.toBeUndefined()
    expect(context().sources[0]?.loop).toBe(true)
    expect(context().sources[0]?.startArgs).toBeNull()

    const clean = await boot()
    await clean.player.start()
    const source = context().sources[0]
    const gain = source?.outputs[0] as FakeGain
    if (!source || !gain) throw new Error('missing slot')
    source.failDisconnect = true
    gain.failDisconnect = true
    source.onended?.()
    source.failStop = true
    await expect(clean.player.skipTrack()).resolves.toBeUndefined()
    expect(liveSources()).toHaveLength(1)
    liveSources()[0]!.failStop = true
    clean.player.stop()
    expect(liveSources()).toHaveLength(0)
  })

  it('does nothing audible when the browser has no audio context', async () => {
    const { player } = await boot({ context: false })
    player.noteTypingActivity()
    player.setPreferences(prefs({ pauseOnTyping: true, volume: 1, screenReaderMode: false }))
    player.noteTypingActivity()
    await expect(player.start()).resolves.toBeUndefined()
    await player.skipTrack()
    player.setVisibilityPaused(true)
    player.setVisibilityPaused(false)
    player.stop()
    expect(FakeAudioContext.contexts).toHaveLength(0)
    expect(controls.fetched.filter((url) => !url.includes('manifest.json'))).toHaveLength(0)
  })
})

describe('ambient singleton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('pauses when the document hides and resumes when it is shown', async () => {
    vi.resetModules()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: FakeAudioContext })
    const mod = await import('../src/lib/ambient')
    const spy = vi.spyOn(mod.ambientPlayer, 'setVisibilityPaused')
    let hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(spy).toHaveBeenNthCalledWith(1, true)
    expect(spy).toHaveBeenNthCalledWith(2, false)
  })
})
