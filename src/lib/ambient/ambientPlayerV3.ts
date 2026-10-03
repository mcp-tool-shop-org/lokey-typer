import { getAudioContext, resumeAudioContext } from '../audioContext'
import {
  fetchAmbientManifest,
  type AmbientCategory,
  type AmbientTrack,
} from '../ambientManifest'
import { AmbientHistoryV3 } from './ambientHistoryV3'
import { LRUBufferCache } from './lruBufferCache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AmbientPrefs = {
  enabled: boolean
  volume: number
  category: AmbientCategory | 'all'
  pauseOnTyping: boolean
  reducedMotion: boolean
  screenReaderMode: boolean
}

type TrackSlot = {
  track: AmbientTrack
  source: AudioBufferSourceNode
  gain: GainNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function ramp(param: AudioParam, ctx: AudioContext, value: number, seconds: number) {
  const t0 = ctx.currentTime
  param.cancelScheduledValues(t0)
  param.setValueAtTime(param.value, t0)
  param.linearRampToValueAtTime(value, t0 + Math.max(0.01, seconds))
}

async function fetchDecode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return await ctx.decodeAudioData(ab)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// AmbientPlayerV3
// ---------------------------------------------------------------------------

const MAX_VOLUME = 0.7
const CROSSFADE_SEC_MIN = 6
const CROSSFADE_SEC_MAX = 8
const ROTATION_MIN_MS = 5 * 60_000
const ROTATION_MAX_MS = 10 * 60_000

export class AmbientPlayerV3 {
  // Manifest
  private manifest: { tracks: AmbientTrack[] } | null = null
  private manifestLoadedAtMs: number | null = null

  // Prefs
  private enabled = true
  private desiredVolume = 0.35
  private category: AmbientCategory | 'all' = 'all'
  private pauseOnTyping = false
  private reducedMotion = false
  private screenReaderMode = false

  // Playback state
  private masterGain: GainNode | null = null
  private masterConnected = false
  private currentSlot: TrackSlot | null = null
  private preloadedTrack: AmbientTrack | null = null
  private preloadedBuffer: AudioBuffer | null = null
  private started = false
  private pausedByVisibility = false

  // Timers
  private rotationTimer: number | null = null
  private typingDuckTimer: number | null = null

  // Caches
  private bufferCache = new LRUBufferCache(5)
  private history = new AmbientHistoryV3()
  private sessionPlayed: string[] = []

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Call once on first user gesture. Loads manifest, picks track, starts. */
  async start(): Promise<void> {
    if (this.started) {
      console.log('[ambient] start() skipped — already started')
      return
    }
    this.started = true
    console.log('[ambient] start() — resuming audio context')

    await resumeAudioContext()
    await this.ensureManifestLoaded()

    const tracks = this.getFilteredTracks()
    console.log('[ambient] manifest loaded, %d tracks, enabled=%s, shouldPlay=%s', tracks.length, this.enabled, this.shouldPlay())

    if (!this.shouldPlay()) return

    await this.playRandomTrack()
    this.scheduleRotation()
  }

  /** Fade out and disconnect everything. */
  stop(): void {
    this.fadeOutAndClear()
    this.clearRotationTimer()
    this.started = false
  }

  /** Sync preferences from the AmbientProvider. */
  setPreferences(p: AmbientPrefs): void {
    const wasEnabled = this.enabled && !this.screenReaderMode
    const wasCategory = this.category

    this.enabled = p.enabled
    this.desiredVolume = clamp(p.volume, 0, 1)
    this.category = p.category
    this.pauseOnTyping = p.pauseOnTyping
    this.reducedMotion = p.reducedMotion
    this.screenReaderMode = p.screenReaderMode

    const nowEnabled = this.enabled && !this.screenReaderMode

    // Volume change: smooth ramp.
    this.applyMasterVolume(0.4)

    // Toggled off: fade out.
    if (wasEnabled && !nowEnabled) {
      this.fadeOutAndClear()
      this.clearRotationTimer()
      return
    }

    // Toggled on: start if not already playing.
    if (!wasEnabled && nowEnabled && this.started) {
      void this.playRandomTrack()
      this.scheduleRotation()
      return
    }

    // Category changed while playing: crossfade to new track from new category.
    if (wasCategory !== this.category && this.currentSlot && nowEnabled) {
      this.preloadedTrack = null
      this.preloadedBuffer = null
      void this.rotate()
      return
    }
  }

  /** Skip to a new random track with a crossfade. */
  async skipTrack(): Promise<void> {
    if (!this.started) return
    if (!this.shouldPlay()) return
    this.preloadedTrack = null
    this.preloadedBuffer = null
    await this.rotate()
  }

  /** Duck volume briefly when user is actively typing. */
  noteTypingActivity(): void {
    if (!this.pauseOnTyping) return
    if (!this.masterGain) return

    const ctx = getAudioContext()
    if (!ctx) return

    // Fade down quickly.
    ramp(this.masterGain.gain, ctx, 0, 0.12)

    // Restore after idle.
    if (this.typingDuckTimer != null) window.clearTimeout(this.typingDuckTimer)
    this.typingDuckTimer = window.setTimeout(() => {
      if (!this.shouldPlay()) return
      this.applyMasterVolume(0.6)
    }, 900)
  }

  /** Fade on tab blur, restore on tab focus. */
  setVisibilityPaused(hidden: boolean): void {
    this.pausedByVisibility = hidden
    if (!this.masterGain) return

    const ctx = getAudioContext()
    if (!ctx) return

    if (hidden) {
      ramp(this.masterGain.gain, ctx, 0, 0.6)
    } else {
      this.applyMasterVolume(0.8)
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private shouldPlay(): boolean {
    return this.enabled && !this.screenReaderMode && !this.pausedByVisibility
  }

  private effectiveVolume(): number {
    // Quadratic curve for perceptual volume control.
    // Human hearing is logarithmic, so a linear slider feels wrong.
    // x^2 gives finer control at the quiet end while still being audible
    // at typical default levels (0.35–0.5).
    const linear = clamp(this.desiredVolume, 0, 1)
    return clamp(linear * linear * MAX_VOLUME, 0, MAX_VOLUME)
  }

  private ensureMasterGain(): { ctx: AudioContext; master: GainNode } | null {
    const ctx = getAudioContext()
    if (!ctx) return null

    if (!this.masterGain) {
      this.masterGain = ctx.createGain()
      this.masterGain.gain.value = 0
    }

    if (!this.masterConnected) {
      this.masterGain.connect(ctx.destination)
      this.masterConnected = true
    }

    return { ctx, master: this.masterGain }
  }

  private applyMasterVolume(seconds: number): void {
    const g = this.ensureMasterGain()
    if (!g) return
    const v = this.shouldPlay() ? this.effectiveVolume() : 0
    ramp(g.master.gain, g.ctx, v, seconds)
  }

  private async ensureManifestLoaded(): Promise<void> {
    const nowMs = Date.now()
    if (this.manifest && this.manifestLoadedAtMs && nowMs - this.manifestLoadedAtMs < 60_000) return

    const m = await fetchAmbientManifest()
    this.manifest = m ? { tracks: m.tracks } : { tracks: [] }
    this.manifestLoadedAtMs = nowMs
  }

  private getFilteredTracks(): AmbientTrack[] {
    if (!this.manifest) return []
    if (this.category === 'all') return this.manifest.tracks
    return this.manifest.tracks.filter((t) => t.category === this.category)
  }

  private pickRandomTrack(): AmbientTrack | null {
    const candidates = this.getFilteredTracks()
    if (candidates.length === 0) return null

    const currentId = this.currentSlot?.track.id ?? null

    // Prefer tracks not played recently (cross-session + session).
    // History window is capped at half the catalog so fresh tracks remain available.
    const historyWindow = Math.min(Math.floor(candidates.length / 2), 20)
    const fresh = candidates.filter(
      (t) =>
        t.id !== currentId &&
        !this.history.wasPlayedRecently(t.id, historyWindow) &&
        !this.sessionPlayed.includes(t.id),
    )

    // Fallback: anything except the currently playing track.
    const fallback = candidates.length > 1
      ? candidates.filter((t) => t.id !== currentId)
      : candidates

    const pool = fresh.length > 0 ? fresh : fallback
    const idx = Math.floor(Math.random() * pool.length)
    return pool[idx] ?? null
  }

  private async getBuffer(track: AmbientTrack): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(track.path)
    if (cached) return cached

    const ctx = getAudioContext()
    if (!ctx) return null

    const resolvedPath = track.path.startsWith('/')
      ? `${import.meta.env.BASE_URL}${track.path.slice(1)}`
      : track.path
    const buf = await fetchDecode(ctx, resolvedPath)
    if (buf) this.bufferCache.set(track.path, buf)
    return buf
  }

  private createSlot(track: AmbientTrack, buf: AudioBuffer, startGain: number): TrackSlot | null {
    const g = this.ensureMasterGain()
    if (!g) return null

    const source = g.ctx.createBufferSource()
    source.buffer = buf
    source.loop = true

    const gain = g.ctx.createGain()
    gain.gain.value = startGain

    source.connect(gain)
    gain.connect(g.master)

    // Randomized loop start offset (0–8s).
    const offset = clamp(Math.random() * 8, 0, Math.max(0, buf.duration - 0.01))
    try {
      source.start(0, offset)
    } catch {
      // ignore
    }

    return { track, source, gain }
  }

  private stopSlot(slot: TrackSlot, fadeSec = 0.5): void {
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      ramp(slot.gain.gain, ctx, 0, fadeSec)
      slot.source.stop(ctx.currentTime + fadeSec + 0.1)
    } catch {
      // ignore
    }
  }

  private async playRandomTrack(): Promise<void> {
    await this.ensureManifestLoaded()
    const track = this.pickRandomTrack()
    if (!track) { console.warn('[ambient] no track picked'); return }

    const buf = await this.getBuffer(track)
    if (!buf) { console.warn('[ambient] failed to decode buffer for %s', track.path); return }

    const slot = this.createSlot(track, buf, 1)
    if (!slot) { console.warn('[ambient] failed to create slot'); return }

    // If something was already playing, stop it cleanly.
    if (this.currentSlot) {
      this.stopSlot(this.currentSlot, 1.0)
    }

    this.currentSlot = slot
    this.sessionPlayed.push(track.id)
    this.history.noteTrackPlayed(track.id)
    this.applyMasterVolume(1.0)
    console.log('[ambient] playing: %s (%s) vol=%f', track.title, track.path, this.effectiveVolume())

    // Preload next track.
    void this.preloadNext()
  }

  private async preloadNext(): Promise<void> {
    const track = this.pickRandomTrack()
    if (!track) {
      this.preloadedTrack = null
      this.preloadedBuffer = null
      return
    }

    const buf = await this.getBuffer(track)
    this.preloadedTrack = track
    this.preloadedBuffer = buf
  }

  private async rotate(): Promise<void> {
    if (!this.shouldPlay()) return
    if (this.reducedMotion) return

    await this.ensureManifestLoaded()

    // Use preloaded if available and still matches category.
    let nextTrack = this.preloadedTrack
    let nextBuf = this.preloadedBuffer

    if (
      !nextTrack ||
      !nextBuf ||
      (this.category !== 'all' && nextTrack.category !== this.category)
    ) {
      nextTrack = this.pickRandomTrack()
      if (!nextTrack) return
      nextBuf = await this.getBuffer(nextTrack)
      if (!nextBuf) return
    }

    const ctx = getAudioContext()
    if (!ctx) return

    // Create new slot at gain 0, then crossfade.
    const newSlot = this.createSlot(nextTrack, nextBuf, 0)
    if (!newSlot) return

    const fadeSec = CROSSFADE_SEC_MIN + Math.random() * (CROSSFADE_SEC_MAX - CROSSFADE_SEC_MIN)

    // Fade in new.
    ramp(newSlot.gain.gain, ctx, 1, fadeSec)

    // Fade out old.
    const oldSlot = this.currentSlot
    if (oldSlot) {
      ramp(oldSlot.gain.gain, ctx, 0, fadeSec)
      try {
        oldSlot.source.stop(ctx.currentTime + fadeSec + 0.2)
      } catch {
        // ignore
      }
    }

    this.currentSlot = newSlot
    this.sessionPlayed.push(nextTrack.id)
    this.history.noteTrackPlayed(nextTrack.id)

    // Clear preloaded and prepare next.
    this.preloadedTrack = null
    this.preloadedBuffer = null
    void this.preloadNext()

    // Reschedule rotation.
    this.scheduleRotation()
  }

  private scheduleRotation(): void {
    this.clearRotationTimer()
    if (this.reducedMotion) return

    const ms = ROTATION_MIN_MS + Math.random() * (ROTATION_MAX_MS - ROTATION_MIN_MS)
    this.rotationTimer = window.setTimeout(() => {
      void this.rotate()
    }, ms)
  }

  private clearRotationTimer(): void {
    if (this.rotationTimer != null) {
      window.clearTimeout(this.rotationTimer)
      this.rotationTimer = null
    }
  }

  private fadeOutAndClear(): void {
    if (this.currentSlot) {
      this.stopSlot(this.currentSlot, 0.5)
      this.currentSlot = null
    }

    this.preloadedTrack = null
    this.preloadedBuffer = null

    if (this.typingDuckTimer != null) {
      window.clearTimeout(this.typingDuckTimer)
      this.typingDuckTimer = null
    }
  }
}
