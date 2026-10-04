/**
 * @vitest-environment node
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '../src/content/types'
import { passageKey } from '../src/content/catalog'
import { findExercise, loadAllPacks, loadExercisesByMode } from '../src/content/loadPacks'
import { LRUBufferCache } from '../src/lib/ambient/lruBufferCache'
import { AmbientHistoryV3 } from '../src/lib/ambient/ambientHistoryV3'
import {
  AMBIENT_CATEGORIES,
  AMBIENT_CATEGORY_LABELS,
  ambientCategoriesInTracks,
  fetchAmbientManifest,
} from '../src/lib/ambientManifest'
import { attackOffsetSamples } from '../src/lib/attackOffset'
import { getAudioContext, resumeAudioContext } from '../src/lib/audioContext'
import { competitiveMinLength } from '../src/lib/repeatPassage'
import { computeErrorHotspots, noteMistake, updateSkillModelFromRun } from '../src/lib/skillModel'
import {
  appendRun,
  bestAccuracyForExercise,
  bestWpmForExercise,
  getOrCreateUserId,
  getPersonalBest,
  loadLastMode,
  loadPersonalBests,
  loadPreferences,
  loadRecents,
  loadRuns,
  loadSkillModel,
  maybeUpdatePersonalBest,
  pushRecent,
  resetPreferencesToDefaults,
  saveLastMode,
  savePreferences,
  saveSkillModel,
  sanitizePreferences,
  topCompetitiveRuns,
  type Preferences,
  type RunResult,
  type UserSkillModel,
} from '../src/lib/storage'
import { isScreenReaderSafePassage } from '../src/lib/passageShape'
import * as publicLib from '../src/lib/public'
import * as rootLib from '../src/lib'

const gates = vi.hoisted(() => ({
  override: null as null | ((mode: 'focus' | 'real_life' | 'competitive') => unknown[] | null),
}))

vi.mock('@content', async () => {
  const actual = await vi.importActual<typeof import('../src/content')>('@content')
  return {
    ...actual,
    loadExercisesByMode: (mode: 'focus' | 'real_life' | 'competitive') => {
      const replaced = gates.override?.(mode)
      if (replaced) return replaced
      return actual.loadExercisesByMode(mode)
    },
  }
})

const originalFetch = globalThis.fetch

afterEach(() => {
  gates.override = null
  globalThis.fetch = originalFetch
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function installMemoryStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true })
  return store
}

function lengthBucket(wpm = 0, runs = 0) {
  return { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs }
}

function skillShell(overrides: Partial<UserSkillModel> = {}): UserSkillModel {
  return {
    version: 2,
    updated_at: '2026-01-01T00:00:00.000Z',
    total_runs: 2,
    ema: { wpm: 40, accuracy: 0.98, backspace_rate: 0.05 },
    by_mode: {
      focus: { ema_wpm: 40, ema_accuracy: 0.98, ema_backspace_rate: 0.05, runs: 2 },
      real_life: { ema_wpm: 30, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      competitive: { ema_wpm: 50, ema_accuracy: 0.97, ema_backspace_rate: 0.02, runs: 1 },
    },
    errors_by_class: { letters: 1 },
    weakness_by_tag: {},
    performance_by_length: {
      short: lengthBucket(),
      medium: lengthBucket(),
      long: lengthBucket(),
      multiline: lengthBucket(),
    },
    weak_tags: [],
    recent_exercise_ids_by_mode: { focus: ['old'], real_life: [], competitive: [] },
    ...overrides,
  }
}

function makeRun(overrides: Partial<RunResult> = {}): RunResult {
  return {
    exercise_id: 'ex-1',
    timestamp: 1_700_000_000_000,
    mode: 'focus',
    wpm: 48,
    accuracy: 0.96,
    errors: 1,
    backspaces: 2,
    duration_ms: 20_000,
    tags_hit: ['apostrophe', 'punctuation'],
    ...overrides,
  }
}

function makeTextExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    mode: 'focus',
    pack: 'pack',
    title: 'Title',
    difficulty: 2,
    estimated_seconds: 20,
    tags: ['apostrophe', 'punctuation'],
    text: "It's fine.",
    ...overrides,
  }
}

function baseFeedback(overrides: Partial<Parameters<typeof publicLib.buildFeedback>[0]> = {}) {
  return publicLib.buildFeedback({
    mode: 'focus',
    wpm: 40,
    accuracy: 0.94,
    errors: 0,
    backspaces: 6,
    duration_ms: 1_000,
    is_personal_best_wpm: false,
    is_personal_best_accuracy: false,
    delta_wpm_vs_best: 0,
    delta_accuracy_vs_best: 0,
    ...overrides,
  })
}

function recExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    mode: 'focus',
    pack: 'pack',
    title: id,
    difficulty: 3,
    estimated_seconds: 40,
    tags: ['calm'],
    text: 'Hello world',
    text_short: 'Hello world',
    ...overrides,
  }
}

describe('storage legacy keys', () => {
  it('copies legacy keys, keeps a key that already exists, and ignores a write that throws', () => {
    const store = installMemoryStorage()
    store.set('lkt_prefs_v1', 'new-prefs')
    store.set('tt_prefs_v1', 'old-prefs')
    store.set('tt_prefs_v1_lkg', '{"volume":0.2}')
    store.set('tt_runs_v1', '[]')
    store.set('tt_recents_v1', '{"byMode":{}}')
    store.set('tt_last_mode_v1', 'competitive')
    store.set('tt_user_id_v1', 'user-id-migrated')
    store.set('tt_skill_v1', '{"version":2}')

    const storage = globalThis.localStorage
    const write = storage.setItem.bind(storage)
    storage.setItem = (key: string, value: string) => {
      if (key === 'lkt_runs_v1') throw new Error('quota')
      write(key, value)
    }

    expect(loadLastMode()).toBe('competitive')
    expect(getOrCreateUserId()).toBe('user-id-migrated')
    expect(store.get('lkt_prefs_v1')).toBe('new-prefs')
    expect(store.get('lkt_prefs_v1_lkg')).toBe('{"volume":0.2}')
    expect(store.has('lkt_runs_v1')).toBe(false)
    expect(store.has('lkt_pbs_v1')).toBe(false)
    expect(store.get('lkt_recents_v1')).toBe('{"byMode":{}}')
    expect(store.get('lkt_skill_v1')).toBe('{"version":2}')

    installMemoryStorage()
  })
})

describe('public barrels', () => {
  it('re-exports the functions the UI calls and constructs the players without starting them', () => {
    expect(rootLib.noteMistake).toBe(publicLib.noteMistake)
    expect(rootLib.buildFeedback).toBe(publicLib.buildFeedback)
    expect(rootLib.ambientPlayer).toBe(publicLib.ambientPlayer)
    expect(rootLib.typewriterAudio).toBe(publicLib.typewriterAudio)
    expect(rootLib.ambientPlayer).toBeTruthy()
    expect(rootLib.typewriterAudio).toBeTruthy()
    expect(publicLib.noteMistake({}, 'a').letters).toBe(1)
  })
})

describe('mode paths', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('maps paths and labels for every mode', () => {
    expect(publicLib.pathToMode('focus')).toBe('focus')
    expect(publicLib.pathToMode('competitive')).toBe('competitive')
    expect(publicLib.pathToMode('real-life')).toBe('real_life')
    expect(publicLib.modeToPath('focus')).toBe('focus')
    expect(publicLib.modeToPath('competitive')).toBe('competitive')
    expect(publicLib.modeToPath('real_life')).toBe('real-life')
    expect(publicLib.modeLabel('focus')).toBe('Focus')
    expect(publicLib.modeLabel('competitive')).toBe('Competitive')
    expect(publicLib.modeLabel('real_life')).toBe('Real-Life')
  })

  it('uses the saved mode for quickstart and falls back to focus', () => {
    expect(publicLib.preferredQuickstartMode()).toBe('focus')
    expect(saveLastMode('competitive')).toBe(true)
    expect(publicLib.preferredQuickstartMode()).toBe('competitive')
    expect(saveLastMode('real_life')).toBe(true)
    expect(loadLastMode()).toBe('real_life')
    expect(publicLib.preferredQuickstartMode()).toBe('real_life')
    store.set('lkt_last_mode_v1', 'nope')
    expect(loadLastMode()).toBeNull()
    expect(publicLib.preferredQuickstartMode()).toBe('focus')

    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(saveLastMode('focus')).toBe(false)
    expect(store.get('lkt_last_mode_v1')).toBe('nope')
  })
})

describe('typing stats', () => {
  it('clamps, times a real run, and formats the clock', () => {
    expect(publicLib.clamp(2, 0, 1)).toBe(1)
    expect(publicLib.clamp(-1, 0, 1)).toBe(0)
    expect(publicLib.clamp(0.4, 0, 1)).toBe(0.4)

    expect(
      publicLib.computeStats({ startedAtMs: null, nowMs: 5_000, correctChars: 0, incorrectChars: 0 }),
    ).toEqual({ elapsedMs: 0, correctChars: 0, incorrectChars: 0, accuracy: 1, wpm: 0 })

    const idle = publicLib.computeStats({ startedAtMs: 1_000, nowMs: 1_000, correctChars: 10, incorrectChars: 0 })
    expect(idle.elapsedMs).toBe(0)
    expect(idle.wpm).toBe(0)
    expect(idle.accuracy).toBe(1)

    const reversed = publicLib.computeStats({
      startedAtMs: 5_000,
      nowMs: 1_000,
      correctChars: 10,
      incorrectChars: 0,
    })
    expect(reversed.elapsedMs).toBe(0)

    const run = publicLib.computeStats({ startedAtMs: 0, nowMs: 60_000, correctChars: 50, incorrectChars: 10 })
    expect(run.elapsedMs).toBe(60_000)
    expect(run.accuracy).toBeCloseTo(50 / 60)
    expect(run.wpm).toBeCloseTo(10)

    const over = publicLib.computeStats({ startedAtMs: 0, nowMs: 60_000, correctChars: 10, incorrectChars: -5 })
    expect(over.accuracy).toBe(1)

    expect(publicLib.formatMs(0)).toBe('0:00')
    expect(publicLib.formatMs(999)).toBe('0:00')
    expect(publicLib.formatMs(1_000)).toBe('0:01')
    expect(publicLib.formatMs(61_000)).toBe('1:01')
    expect(publicLib.formatMs(3_599_000)).toBe('59:59')
  })
})

describe('buildFeedback', () => {
  it('chooses every calm line and hides an empty secondary', () => {
    expect(baseFeedback({ is_personal_best_wpm: true, accuracy: 0.97 }).primary).toBe(
      'New personal best, and you kept it clean.',
    )
    expect(baseFeedback({ accuracy: 0.99, duration_ms: 20_000 }).primary).toBe(
      'Excellent control. That was very clean.',
    )
    expect(baseFeedback({ accuracy: 0.98 }).primary).toBe('Strong accuracy. Nice, steady work.')
    expect(baseFeedback({ accuracy: 0.97, errors: 2 }).primary).toBe('Calm and consistent\u2014great finish.')
    expect(baseFeedback({ accuracy: 0.96, wpm: 55, errors: 10, backspaces: 20 }).primary).toBe(
      'Good pace, and you stayed in control.',
    )
    expect(baseFeedback({ accuracy: 0.94, wpm: 10, backspaces: 5, duration_ms: 20_000, errors: 0 }).primary).toBe(
      'Minimal corrections. Smooth flow.',
    )
    expect(baseFeedback({ accuracy: 0.95, wpm: 10, backspaces: 6, errors: 1 }).primary).toBe(
      'Nice recovery. You kept moving steadily.',
    )
    expect(baseFeedback({ accuracy: 0.9, wpm: 10, backspaces: 6, errors: 3 }).primary).toBe(
      'Some keys were less consistent this run.',
    )

    const steady = baseFeedback({ mode: 'real_life' })
    expect(steady.primary).toBe('Good session. Steady work.')
    expect(steady.secondary).toBeUndefined()
    expect(steady.isNewPb).toBe(false)

    expect(baseFeedback({ backspaces: 15 }).secondary).toBe('Corrections were frequent.')
    expect(baseFeedback({ backspaces: 0, errors: 8 }).secondary).toBe('Errors added up in a few spots.')
    expect(baseFeedback({ backspaces: 0, errors: 0, wpm: 34, duration_ms: 30_000 }).secondary).toBe(
      'Pace stayed steady over the full run.',
    )
    expect(baseFeedback({ backspaces: 0, errors: 0, wpm: 40, duration_ms: 30_000 }).secondary).toBeUndefined()
    expect(baseFeedback({ is_personal_best_accuracy: true }).isNewPb).toBe(true)
  })

  it('chooses every competitive line, including the WPM delta', () => {
    expect(
      baseFeedback({ mode: 'competitive', is_personal_best_wpm: true, accuracy: 0.95 }).primary,
    ).toBe('New PB WPM. Still controlled.')
    expect(
      baseFeedback({
        mode: 'competitive',
        is_personal_best_accuracy: true,
        accuracy: 0.9,
        duration_ms: 20_000,
      }).primary,
    ).toBe('New PB accuracy. Clean run.')
    expect(baseFeedback({ mode: 'competitive', accuracy: 0.99 }).primary).toBe(
      'Elite accuracy. Plenty of control.',
    )
    expect(baseFeedback({ mode: 'competitive', wpm: 60, accuracy: 0.97 }).primary).toBe(
      'Fast and clean. That\u2019s the zone.',
    )
    expect(baseFeedback({ mode: 'competitive', wpm: 60, accuracy: 0.94 }).primary).toBe(
      'Pace is there. Tighten accuracy to convert it.',
    )
    expect(baseFeedback({ mode: 'competitive', wpm: 40, accuracy: 0.94 }).primary).toBe(
      'Accuracy dipped. A cleaner run is available.',
    )
    expect(baseFeedback({ mode: 'competitive', wpm: 50, accuracy: 0.96 }).primary).toBe(
      'Solid run. Clean speed is there.',
    )

    expect(baseFeedback({ mode: 'competitive', delta_wpm_vs_best: 1, accuracy: 0.96 }).secondary).toBe(
      'Up vs best: +1.0 WPM.',
    )
    expect(baseFeedback({ mode: 'competitive', delta_wpm_vs_best: 1.24, accuracy: 0.96 }).secondary).toBe(
      'Up vs best: +1.2 WPM.',
    )
    expect(baseFeedback({ mode: 'competitive', delta_wpm_vs_best: -1, accuracy: 0.99 }).secondary).toBe(
      'Down vs best: -1.0 WPM.',
    )
    expect(baseFeedback({ mode: 'competitive', delta_wpm_vs_best: -2, accuracy: 0.5 }).secondary).toBe(
      'Down vs best: -2.0 WPM.',
    )
    expect(baseFeedback({ mode: 'competitive', backspaces: 15, delta_wpm_vs_best: 0.4 }).secondary).toBe(
      'Backspaces were frequent.',
    )
    expect(baseFeedback({ mode: 'competitive', errors: 10, backspaces: 0 }).secondary).toBe('Errors spiked.')
    expect(baseFeedback({ mode: 'competitive', accuracy: 0.96, wpm: 50 }).secondary).toBeUndefined()

    const pb = baseFeedback({ mode: 'competitive', is_personal_best_wpm: true, is_personal_best_accuracy: true, accuracy: 0.99 })
    expect(pb.isNewPb).toBe(true)
  })
})

describe('attack offset', () => {
  it('uses the absolute peak, a custom ratio, and zero when nothing crosses the gate', () => {
    const under = new Float32Array([9.9e-5])
    expect(attackOffsetSamples(under)).toBe(0)
    expect(attackOffsetSamples(new Float32Array(0))).toBe(0)

    const atGate = new Float32Array([0, 0, 2e-4])
    expect(attackOffsetSamples(atGate)).toBe(2)

    const negative = new Float32Array(8)
    negative[1] = 0.02
    negative[4] = -0.8
    expect(attackOffsetSamples(negative, 0.2)).toBe(4)
    expect(attackOffsetSamples(negative, 2)).toBe(0)
    expect(attackOffsetSamples(negative, 1)).toBe(4)
  })
})

describe('audio context', () => {
  it('stays null without a constructor, then resumes one shared webkit context', async () => {
    vi.unstubAllGlobals()
    expect(typeof window).toBe('undefined')
    expect(getAudioContext()).toBeNull()
    await resumeAudioContext()

    vi.stubGlobal('window', {})
    expect(getAudioContext()).toBeNull()
    await resumeAudioContext()

    class FakeAudioContext {
      state: 'suspended' | 'running' = 'suspended'
      resume = vi.fn(async () => {
        this.state = 'running'
      })
    }
    vi.stubGlobal('window', { webkitAudioContext: FakeAudioContext })

    const first = getAudioContext()
    const second = getAudioContext()
    expect(first).toBeInstanceOf(FakeAudioContext)
    expect(second).toBe(first)
    await resumeAudioContext()
    expect(first?.resume).toHaveBeenCalledTimes(1)
    expect(first?.state).toBe('running')
    await resumeAudioContext()
    expect(first?.resume).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })
})

describe('buffer cache', () => {
  it('evicts the least recently used buffer and honors a floor of one', () => {
    const cache = new LRUBufferCache(2)
    const first = { name: 'a' } as unknown as AudioBuffer
    const second = { name: 'b' } as unknown as AudioBuffer
    const third = { name: 'c' } as unknown as AudioBuffer
    const replaced = { name: 'a2' } as unknown as AudioBuffer

    expect(cache.get('missing')).toBeUndefined()
    expect(cache.has('missing')).toBe(false)
    cache.set('a', first)
    cache.set('b', second)
    expect(cache.get('a')).toBe(first)
    cache.set('c', third)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('c')).toBe(true)
    cache.set('a', replaced)
    expect(cache.get('a')).toBe(replaced)
    expect(cache.size).toBe(2)
    cache.clear()
    expect(cache.size).toBe(0)

    const tiny = new LRUBufferCache(0)
    tiny.set('a', first)
    tiny.set('b', second)
    expect(tiny.size).toBe(1)
    expect(tiny.has('a')).toBe(false)
    expect(tiny.has('b')).toBe(true)

    const wide = new LRUBufferCache()
    for (let i = 0; i < 6; i++) wide.set(`k${i}`, { name: i } as unknown as AudioBuffer)
    expect(wide.size).toBe(5)
    expect(wide.has('k0')).toBe(false)
    expect(wide.has('k5')).toBe(true)
  })
})

describe('ambient history', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('drops bad rows, answers recent-play questions, and caps the list at 200', () => {
    const history = new AmbientHistoryV3()
    expect(history.wasPlayedRecently('none')).toBe(false)
    expect(history.wasPlayedWithinMs('none', 1_000)).toBe(false)

    const now = Date.now()
    store.set(
      'lkt_ambient_history_v3',
      JSON.stringify({
        recentTracks: [
          { id: 'old', atMs: now - 60_000 },
          { id: 'future', atMs: now + 10_000 },
          null,
          { id: '', atMs: 10 },
          { id: 'bad-time', atMs: -5 },
          { id: 'nan', atMs: Number.NaN },
          { id: 'inf', atMs: Number.POSITIVE_INFINITY },
          { foo: 1 },
        ],
      }),
    )

    expect(history.wasPlayedRecently('old', 1)).toBe(true)
    expect(history.wasPlayedRecently('future', 1)).toBe(false)
    expect(history.wasPlayedRecently('future')).toBe(true)
    expect(history.wasPlayedRecently('bad-time')).toBe(false)
    expect(history.wasPlayedWithinMs('old', 10_000)).toBe(false)
    expect(history.wasPlayedWithinMs('old', 120_000)).toBe(true)
    expect(history.wasPlayedWithinMs('future', 0)).toBe(true)
    expect(history.wasPlayedWithinMs('missing', 120_000)).toBe(false)

    history.noteTrackPlayed('future')
    history.noteTrackPlayed('fresh')
    expect(history.wasPlayedRecently('fresh', 1)).toBe(true)
    const saved = JSON.parse(store.get('lkt_ambient_history_v3') ?? '{}') as {
      recentTracks: { id: string }[]
    }
    expect(saved.recentTracks[0].id).toBe('fresh')
    expect(saved.recentTracks.filter((row) => row.id === 'future')).toHaveLength(1)

    const bulky = Array.from({ length: 250 }, (_, index) => ({ id: `h${index}`, atMs: index + 1 }))
    store.set('lkt_ambient_history_v3', JSON.stringify({ recentTracks: bulky }))
    expect(history.wasPlayedRecently('h0', 250)).toBe(true)
    expect(history.wasPlayedRecently('h199', 250)).toBe(true)
    expect(history.wasPlayedRecently('h200', 250)).toBe(false)

    for (let i = 0; i < 205; i++) history.noteTrackPlayed(`t${i}`)
    expect(history.wasPlayedRecently('t204')).toBe(true)
    expect(history.wasPlayedRecently('t5', 200)).toBe(true)
    expect(history.wasPlayedRecently('t4', 200)).toBe(false)
  })

  it('ignores corrupt storage, a failed write, and a missing localStorage', () => {
    const history = new AmbientHistoryV3()
    store.set('lkt_ambient_history_v3', '{')
    expect(history.wasPlayedRecently('x')).toBe(false)
    store.set('lkt_ambient_history_v3', JSON.stringify({ recentTracks: { id: 'a' } }))
    expect(history.wasPlayedRecently('a')).toBe(false)
    store.set('lkt_ambient_history_v3', JSON.stringify(null))
    expect(history.wasPlayedRecently('a')).toBe(false)

    store.set(
      'lkt_ambient_history_v3',
      JSON.stringify({ recentTracks: [{ id: 'kept', atMs: Date.now() }] }),
    )
    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(() => history.noteTrackPlayed('new')).not.toThrow()
    expect(history.wasPlayedRecently('kept')).toBe(true)
    expect(history.wasPlayedRecently('new')).toBe(false)

    storage.getItem = () => {
      throw new Error('blocked')
    }
    expect(history.wasPlayedRecently('kept')).toBe(false)
    expect(() => history.noteTrackPlayed('again')).not.toThrow()

    Reflect.deleteProperty(globalThis, 'localStorage')
    const detached = new AmbientHistoryV3()
    expect(detached.wasPlayedRecently('kept')).toBe(false)
    expect(detached.wasPlayedWithinMs('kept', 1_000)).toBe(false)
    expect(() => detached.noteTrackPlayed('kept')).not.toThrow()
  })
})

describe('ambient manifest', () => {
  it('lists the categories that are actually present', () => {
    expect(AMBIENT_CATEGORIES).toHaveLength(11)
    expect(AMBIENT_CATEGORY_LABELS.cafe).toBe('Café')
    expect(ambientCategoriesInTracks([])).toEqual([])
    expect(
      ambientCategoriesInTracks([
        { category: 'ocean' },
        { category: 'rain' },
        { category: 'ocean' },
        { category: 'white_noise' },
      ]),
    ).toEqual(['rain', 'ocean', 'white_noise'])
  })

  it('drops a bad payload and keeps only complete tracks', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return { ok: false, json: async () => null }
    }) as typeof fetch
    expect(await fetchAmbientManifest()).toBeNull()
    expect(calls[0]).toBe(`${import.meta.env.BASE_URL}audio/ambient/manifest.json`)

    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as typeof fetch
    expect(await fetchAmbientManifest('/missing.json')).toBeNull()

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    })) as typeof fetch
    expect(await fetchAmbientManifest('/bad.json')).toBeNull()

    const payloads: unknown[] = [null, { version: '1', tracks: [] }, { version: Number.POSITIVE_INFINITY, tracks: [] }, { version: 1 }, { version: 1, tracks: 'no' }]
    for (const payload of payloads) {
      globalThis.fetch = (async () => ({ ok: true, json: async () => payload })) as typeof fetch
      expect(await fetchAmbientManifest('/shape.json')).toBeNull()
    }

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ version: 3, tracks: [] }),
    })) as typeof fetch
    expect(await fetchAmbientManifest('/empty.json')).toEqual({ version: 3, tracks: [] })

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        version: 3,
        tracks: [
          null,
          'nope',
          { id: '', title: 't', category: 'rain', path: '/a', duration_sec: 1 },
          { id: 'a', title: 1, category: 'rain', path: '/a', duration_sec: 1 },
          { id: 'b', title: 't', category: 'nope', path: '/a', duration_sec: 1 },
          { id: 'c', title: 't', category: 'rain', path: '', duration_sec: 1 },
          { id: 'd', title: 't', category: 'ocean', path: '/d', duration_sec: Number.NaN },
          {
            id: 'e',
            title: 'E',
            category: 'wind',
            path: '/e',
            duration_sec: 12,
            tags: ['a', 1, null],
            lufs_i: -20,
          },
          { id: 'f', title: 'F', category: 'cafe', path: '/f', duration_sec: 3, lufs_i: Number.NaN, tags: 'rain' },
          { id: 'g', title: 'G', category: 'singing_bowls', path: '/g', duration_sec: 4, lufs_i: 0 },
          { id: 'h', title: 'H', category: 'other', path: '/h', duration_sec: 5, lufs_i: null },
        ],
      }),
    })) as typeof fetch

    const manifest = await fetchAmbientManifest('/mixed.json')
    expect(manifest?.version).toBe(3)
    expect(manifest?.tracks.map((track) => track.id)).toEqual(['e', 'f', 'g', 'h'])
    expect(manifest?.tracks[0]).toMatchObject({ tags: ['a'], lufs_i: -20, category: 'wind' })
    expect(manifest?.tracks[1].tags).toEqual([])
    expect(manifest?.tracks[1].lufs_i).toBeUndefined()
    expect(manifest?.tracks[2].lufs_i).toBe(0)
    expect(manifest?.tracks[3].lufs_i).toBeUndefined()
    expect(manifest?.tracks[3].tags).toEqual([])
  })
})

describe('load packs cache', () => {
  it('reuses the cache and returns null when the id is unknown', () => {
    const packs = loadAllPacks()
    expect(packs.length).toBeGreaterThan(0)
    expect(loadAllPacks()).toBe(packs)
    expect(loadExercisesByMode('focus').length).toBeGreaterThan(0)
    expect(loadExercisesByMode('real_life').length).toBeGreaterThan(0)
    expect(loadExercisesByMode('competitive').length).toBeGreaterThan(0)

    const old = findExercise('focus_calm_01_001')
    const canonical = findExercise('focus_calm_03_001')
    expect(old).not.toBeNull()
    expect(canonical).not.toBeNull()
    expect(old?.id).toBe('focus_calm_01_001')
    expect(passageKey(old!)).toBe(passageKey(canonical!))
    expect(findExercise('missing-exercise-id')).toBeNull()
  })
})

describe('skill model', () => {
  it('counts every character class, including a symbol that is not a single mark', () => {
    const sample = [
      'A',
      '7',
      ' ',
      '\n',
      "'",
      '\u2019',
      '"',
      '\u201c',
      '\u201d',
      '-',
      '\u2013',
      '\u2014',
      '(',
      ')',
      '[',
      ']',
      '{',
      '}',
      '<',
      '>',
      '/',
      '\\',
      ',',
      '.',
      ';',
      ':',
      '?',
      '!',
      '@',
      '_',
      '\t',
      '',
    ]
    let counts: ReturnType<typeof noteMistake> = {}
    for (const ch of sample) counts = noteMistake(counts, ch)
    counts = noteMistake(counts, null)
    counts = noteMistake(counts, 'ab')

    expect(counts.letters).toBe(1)
    expect(counts.numbers).toBe(1)
    expect(counts.space).toBe(1)
    expect(counts.newline).toBe(1)
    expect(counts.apostrophe).toBe(2)
    expect(counts.quotes).toBe(3)
    expect(counts.dash).toBe(3)
    expect(counts.brackets).toBe(9)
    expect(counts.slash).toBe(2)
    expect(counts.punctuation).toBe(6)
    expect(counts.symbol).toBe(4)
    expect(counts.overflow).toBe(1)
    expect(noteMistake({}, '').brackets).toBe(1)
    expect(noteMistake({}, '_').symbol).toBe(1)
    expect(noteMistake({}, '@').symbol).toBe(1)

    const hot = computeErrorHotspots({ target: 'a b', typed: 'axb!' })
    expect(hot.space).toBe(1)
    expect(hot.overflow).toBe(1)
    expect(hot.letters).toBe(0)
    expect(computeErrorHotspots({ target: 'ab', typed: 'a' }).letters).toBe(0)
  })

  it('moves the apostrophe score and decays a clean punctuation tag', () => {
    const next = updateSkillModelFromRun({
      prev: skillShell({ weakness_by_tag: { apostrophe: 0, punctuation: 0.5 } }),
      run: makeRun(),
      exercise: makeTextExercise(),
      targetText: "It's fine.",
      typedText: "It's fine.",
      mistakes: { apostrophe: 1 },
    })

    expect(next.version).toBe(2)
    expect(next.total_runs).toBe(3)
    expect(next.updated_at).toContain('T')
    expect(next.weakness_by_tag.apostrophe).toBeCloseTo(0.2)
    expect(next.weakness_by_tag.punctuation).toBeCloseTo(0.4)
    expect(next.weak_tags).toEqual(['punctuation', 'apostrophe'])
    expect(next.ema.wpm).toBeCloseTo(40 + 0.2 * (48 - 40))
    expect(next.ema.backspace_rate).toBeCloseTo(0.05 + 0.2 * (0.2 - 0.05))
    expect(next.performance_by_length.short.runs).toBe(1)
    expect(next.performance_by_length.short.ema_wpm).toBeCloseTo(9.6)
    expect(next.performance_by_length.medium.runs).toBe(0)
    expect(next.errors_by_class.letters).toBeCloseTo(0.8)
    expect(next.recent_exercise_ids_by_mode.focus).toEqual(['ex-1', 'old'])
    expect(next.by_mode.focus.runs).toBe(3)
  })

  it('repairs missing documents, ignores unmapped tags, and buckets length', () => {
    const seeded: Record<string, number> = { tiny: 0.0004, bad: Number.NaN }
    for (let i = 0; i < 10; i++) seeded[`k${i}`] = (10 - i) / 10

    const repaired = updateSkillModelFromRun({
      prev: skillShell({
        total_runs: undefined as unknown as number,
        ema: undefined as unknown as UserSkillModel['ema'],
        by_mode: undefined as unknown as UserSkillModel['by_mode'],
        errors_by_class: undefined as unknown as UserSkillModel['errors_by_class'],
        weakness_by_tag: seeded,
        recent_exercise_ids_by_mode: undefined as unknown as UserSkillModel['recent_exercise_ids_by_mode'],
        performance_by_length: {
          short: {
            ema_wpm: Number.NaN,
            ema_accuracy: Number.NaN,
            ema_backspace_rate: Number.NaN,
            runs: undefined as unknown as number,
          },
          medium: lengthBucket(),
          long: lengthBucket(),
          multiline: lengthBucket(),
        },
      }),
      run: makeRun({
        backspaces: -4,
        tags_hit: ['numbers', 'not-a-class', 4 as unknown as string],
      }),
      exercise: makeTextExercise(),
      targetText: 'Hi',
      typedText: '',
      mistakes: {
        letters: Number.NaN,
        space: -2,
        punctuation: 'x' as unknown as number,
        overflow: 3,
      },
    })

    expect(repaired.total_runs).toBe(1)
    expect(repaired.ema.wpm).toBeCloseTo(9.6)
    expect(repaired.ema.backspace_rate).toBe(0)
    expect(repaired.by_mode.focus.runs).toBe(1)
    expect(repaired.performance_by_length.short.ema_wpm).toBe(48)
    expect(repaired.performance_by_length.short.runs).toBe(1)
    expect(repaired.errors_by_class.overflow).toBeCloseTo(0.6)
    expect(repaired.weak_tags).toHaveLength(8)
    expect(repaired.weak_tags[0]).toBe('k0')
    expect(repaired.weak_tags).not.toContain('tiny')
    expect(repaired.weak_tags).not.toContain('bad')
    expect(repaired.recent_exercise_ids_by_mode.focus).toEqual(['ex-1'])
    expect(repaired.weakness_by_tag.numbers).toBe(0)

    const medium = updateSkillModelFromRun({
      prev: skillShell(),
      run: makeRun({ tags_hit: undefined, backspaces: 100, exercise_id: 'med' }),
      exercise: makeTextExercise({ id: 'med', estimated_seconds: 90, type: undefined }),
      targetText: 'Hello',
      typedText: 'Hello',
      mistakes: {},
    })
    expect(medium.performance_by_length.medium.runs).toBe(1)
    expect(medium.performance_by_length.short.runs).toBe(0)
    expect(medium.ema.backspace_rate).toBeCloseTo(0.05 + 0.2 * (1 - 0.05))
    expect(medium.weakness_by_tag.apostrophe).toBeUndefined()

    const long = updateSkillModelFromRun({
      prev: skillShell(),
      run: makeRun({ exercise_id: 'long', tags_hit: [] }),
      exercise: makeTextExercise({ id: 'long', estimated_seconds: 91 }),
      targetText: 'Hello',
      typedText: 'Hello',
      mistakes: {},
    })
    expect(long.performance_by_length.long.runs).toBe(1)

    const multiline = updateSkillModelFromRun({
      prev: skillShell(),
      run: makeRun({ exercise_id: 'multi', tags_hit: [] }),
      exercise: makeTextExercise({ id: 'multi', estimated_seconds: 10 }),
      targetText: 'a\nb',
      typedText: 'a\nb',
      mistakes: {},
    })
    expect(multiline.performance_by_length.multiline.runs).toBe(1)
    expect(multiline.performance_by_length.short.runs).toBe(0)

    const fromTemplate = updateSkillModelFromRun({
      prev: skillShell({
        by_mode: {
          real_life: lengthBucket(30, 1),
          competitive: lengthBucket(50, 1),
        } as UserSkillModel['by_mode'],
        recent_exercise_ids_by_mode: {
          focus: 'bad' as unknown as string[],
          real_life: [],
          competitive: [],
        },
      }),
      run: makeRun({ exercise_id: 'tpl', tags_hit: ['quotes'] }),
      exercise: {
        id: 'tpl',
        mode: 'focus',
        pack: 'pack',
        title: 'Template',
        difficulty: 2,
        estimated_seconds: 10,
        tags: ['quotes'],
        type: 'template',
        template: 'Hello\n{name}',
        slots: { name: ['Ada'] },
      },
      targetText: 'plain',
      typedText: 'plain',
      mistakes: { quotes: 1 },
    })
    expect(fromTemplate.performance_by_length.multiline.runs).toBe(1)
    expect(fromTemplate.performance_by_length.short.runs).toBe(0)
    expect(fromTemplate.by_mode.focus.runs).toBe(1)
    expect(fromTemplate.recent_exercise_ids_by_mode.focus).toEqual(['tpl'])
    expect(fromTemplate.weakness_by_tag.quotes).toBe(0)

    const duplicate = updateSkillModelFromRun({
      prev: skillShell({
        recent_exercise_ids_by_mode: { focus: ['ex-1', 'ex-1', 'keep'], real_life: [], competitive: [] },
      }),
      run: makeRun({ tags_hit: [] }),
      exercise: makeTextExercise({ estimated_seconds: 30 }),
      targetText: 'Hi',
      typedText: 'Hi',
      mistakes: {},
    })
    expect(duplicate.recent_exercise_ids_by_mode.focus).toEqual(['ex-1', 'keep'])
    expect(duplicate.performance_by_length.short.runs).toBe(1)
  })
})

describe('preference and run storage', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('sanitizes illegal fields and keeps the legal ones', () => {
    const broken = sanitizePreferences({
      fontScale: 2 as Preferences['fontScale'],
      volume: Number.NaN,
      ambientVolume: Number.NaN,
      ambientCategory: 'lava' as Preferences['ambientCategory'],
      competitiveSprintDurationMs: 15_000 as Preferences['competitiveSprintDurationMs'],
      soundEnabled: 0 as unknown as boolean,
      bellOnCompletion: 1 as unknown as boolean,
      ambientEnabled: true,
      screenReaderMode: true,
      reducedMotion: 1 as unknown as boolean,
      focusMinimalHud: 0 as unknown as boolean,
      competitiveGhostEnabled: 0 as unknown as boolean,
      ambientPauseOnTyping: 1 as unknown as boolean,
      showLiveWpm: { focus: 1 as unknown as boolean },
    })
    expect(broken.fontScale).toBe(1)
    expect(broken.volume).toBe(0.5)
    expect(broken.ambientVolume).toBe(0.5)
    expect(broken.ambientCategory).toBe('all')
    expect(broken.competitiveSprintDurationMs).toBe(60_000)
    expect(broken.soundEnabled).toBe(false)
    expect(broken.bellOnCompletion).toBe(true)
    expect(broken.ambientEnabled).toBe(false)
    expect(broken.screenReaderMode).toBe(true)
    expect(broken.reducedMotion).toBe(true)
    expect(broken.focusMinimalHud).toBe(false)
    expect(broken.competitiveGhostEnabled).toBe(false)
    expect(broken.ambientPauseOnTyping).toBe(true)
    expect(broken.showLiveWpm.focus).toBe(true)

    const edged = sanitizePreferences({
      fontScale: 0.9,
      volume: 5,
      ambientVolume: -3,
      ambientCategory: 'rain',
      competitiveSprintDurationMs: 30_000,
      showLiveWpm: { focus: false, real_life: true, competitive: false },
    })
    expect(edged.fontScale).toBe(0.9)
    expect(edged.volume).toBe(1)
    expect(edged.ambientVolume).toBe(0)
    expect(edged.ambientCategory).toBe('rain')
    expect(edged.competitiveSprintDurationMs).toBe(30_000)
    expect(edged.showLiveWpm).toEqual({ focus: false, real_life: true, competitive: false })
    expect(sanitizePreferences({ fontScale: 1.1, competitiveSprintDurationMs: 120_000 }).fontScale).toBe(1.1)
    expect(sanitizePreferences(null).volume).toBe(0.5)
    expect(sanitizePreferences(undefined).ambientCategory).toBe('all')
    expect(sanitizePreferences({ volume: undefined, ambientVolume: undefined }).volume).toBe(0.5)
  })

  it('repairs a bad live document without touching the backup, and restores from the backup', () => {
    expect(savePreferences(sanitizePreferences({ volume: 0.3, ambientVolume: 0.4 }))).toBe(true)
    const good = JSON.parse(store.get('lkt_prefs_v1') ?? '{}') as Preferences

    store.set('lkt_prefs_v1', JSON.stringify({ ...good, showLiveWpm: undefined, volume: 4 }))
    expect(loadPreferences().volume).toBe(1)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').volume).toBe(0.3)

    store.set(
      'lkt_prefs_v1',
      JSON.stringify({ ...good, showLiveWpm: { focus: 'x', real_life: false, competitive: true } }),
    )
    expect(loadPreferences().showLiveWpm.focus).toBe(true)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').volume).toBe(0.3)

    store.set(
      'lkt_prefs_v1',
      JSON.stringify({ ...good, showLiveWpm: { focus: false, real_life: 'x', competitive: true } }),
    )
    expect(loadPreferences().showLiveWpm.real_life).toBe(true)

    store.set(
      'lkt_prefs_v1',
      JSON.stringify({ ...good, showLiveWpm: { focus: false, real_life: false, competitive: 0 } }),
    )
    expect(loadPreferences().showLiveWpm.competitive).toBe(false)

    store.set('lkt_prefs_v1', JSON.stringify({ ...good, soundEnabled: 'yes', volume: 'nope' }))
    const corrected = loadPreferences()
    expect(corrected.soundEnabled).toBe(true)
    expect(corrected.volume).toBe(0.5)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').volume).toBe(0.3)

    const locked = sanitizePreferences({ screenReaderMode: true, ambientEnabled: true })
    savePreferences(locked)
    const live = JSON.parse(store.get('lkt_prefs_v1') ?? '{}') as Preferences
    expect(live.ambientEnabled).toBe(false)
    live.ambientEnabled = true
    store.set('lkt_prefs_v1', JSON.stringify(live))
    expect(loadPreferences().ambientEnabled).toBe(false)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').ambientEnabled).toBe(false)

    store.set('lkt_prefs_v1', '{')
    expect(loadPreferences().volume).toBe(0.5)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').screenReaderMode).toBe(true)

    store.set('lkt_prefs_v1', '{')
    store.set('lkt_prefs_v1_lkg', '{')
    expect(loadPreferences().volume).toBe(0.5)
    expect(JSON.parse(store.get('lkt_prefs_v1') ?? '{}').volume).toBe(0.5)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').volume).toBe(0.5)

    store.clear()
    expect(loadPreferences().competitiveSprintDurationMs).toBe(60_000)
    expect(store.has('lkt_prefs_v1')).toBe(true)
    expect(store.has('lkt_prefs_v1_lkg')).toBe(true)

    savePreferences(sanitizePreferences({ volume: 0.15 }))
    expect(loadPreferences().volume).toBe(0.15)
    expect(resetPreferencesToDefaults().volume).toBe(0.5)
    expect(loadPreferences().volume).toBe(0.5)
    expect(loadPreferences().showLiveWpm).toEqual({ focus: false, real_life: false, competitive: true })

    const storage = globalThis.localStorage
    const write = storage.setItem.bind(storage)
    storage.setItem = (key: string, value: string) => {
      if (key === 'lkt_prefs_v1_lkg') throw new Error('quota')
      write(key, value)
    }
    expect(savePreferences(sanitizePreferences({ volume: 0.7 }))).toBe(false)
    expect(JSON.parse(store.get('lkt_prefs_v1') ?? '{}').volume).toBe(0.7)
    expect(JSON.parse(store.get('lkt_prefs_v1_lkg') ?? '{}').volume).toBe(0.5)
  })

  it('keeps valid run rows and drops rows that are not a finished run', () => {
    store.set(
      'lkt_runs_v1',
      JSON.stringify([
        {
          v: 2,
          exercise_id: 'ex-valid',
          timestamp: 10,
          mode: 'focus',
          rendered_text_hash: 'abc',
          wpm: 41,
          accuracy: 1.4,
          errors: -1.2,
          backspaces: 2.9,
          duration_ms: -4,
          tags_hit: ['calm', 3, null],
          sprint_duration_ms: 30_000,
        },
        {
          exercise_id: 'ex-hash',
          mode: 'real_life',
          timestamp: 11,
          wpm: 10,
          accuracy: -0.2,
          errors: 1.2,
          backspaces: 0,
          duration_ms: 5,
          rendered_text_hash: 5,
          tags_hit: 'nope',
          sprint_duration_ms: 45_000,
          v: 1,
        },
        {
          exercise_id: 'ex-long',
          mode: 'competitive',
          timestamp: 12,
          wpm: 70,
          accuracy: 0.99,
          errors: 0,
          backspaces: 0,
          duration_ms: 1_000,
          sprint_duration_ms: 120_000,
        },
        {
          exercise_id: 'ex-mid',
          mode: 'competitive',
          timestamp: 13,
          wpm: 30,
          accuracy: 0.96,
          errors: 1,
          backspaces: 1,
          duration_ms: 1_000,
          sprint_duration_ms: 30_000,
        },
        {
          exercise_id: 'ex-hour',
          mode: 'competitive',
          timestamp: 14,
          wpm: 55,
          accuracy: 0.97,
          errors: 0,
          backspaces: 0,
          duration_ms: 1_000,
          sprint_duration_ms: 60_000,
        },
        null,
        'x',
        { exercise_id: '', mode: 'focus', timestamp: 1, wpm: 1, accuracy: 1, errors: 0, backspaces: 0, duration_ms: 1 },
        { exercise_id: 'ex', mode: 'nope', timestamp: 1, wpm: 1, accuracy: 1, errors: 0, backspaces: 0, duration_ms: 1 },
        { exercise_id: 'ex', mode: 'focus', timestamp: 'soon', wpm: 1, accuracy: 1, errors: 0, backspaces: 0, duration_ms: 1 },
        { exercise_id: 'ex', mode: 'focus', timestamp: 1, wpm: 'fast', accuracy: 1, errors: 0, backspaces: 0, duration_ms: 1 },
      ]),
    )

    const rows = loadRuns()
    expect(rows.map((row) => row.exercise_id)).toEqual(['ex-valid', 'ex-hash', 'ex-long', 'ex-mid', 'ex-hour'])
    expect(rows[0]).toMatchObject({
      v: 2,
      accuracy: 1,
      errors: 0,
      backspaces: 2,
      duration_ms: 0,
      tags_hit: ['calm'],
      sprint_duration_ms: 30_000,
      rendered_text_hash: 'abc',
    })
    expect(rows[1].v).toBeUndefined()
    expect(rows[1].rendered_text_hash).toBeUndefined()
    expect(rows[1].tags_hit).toBeUndefined()
    expect(rows[1].sprint_duration_ms).toBeUndefined()
    expect(rows[1].accuracy).toBe(0)
    expect(rows[1].errors).toBe(1)

    expect(topCompetitiveRuns({ durationMs: 30_000, limit: 1 })).toEqual([
      expect.objectContaining({ exercise_id: 'ex-mid', wpm: 30 }),
    ])
    expect(topCompetitiveRuns({ durationMs: 30_000, limit: 5 }).map((row) => row.wpm)).toEqual([30])
    expect(topCompetitiveRuns({ durationMs: 60_000, limit: 0 })).toEqual([])
    expect(bestWpmForExercise('ex-long')).toBeNull()
    expect(bestWpmForExercise('ex-long', 120_000)).toBe(70)
    expect(bestAccuracyForExercise('ex-long', 120_000)).toBe(0.99)
    expect(bestWpmForExercise('ex-hash')).toBe(10)
    expect(bestAccuracyForExercise('ex-hash')).toBe(0)
    expect(bestWpmForExercise('missing')).toBeNull()
    expect(bestAccuracyForExercise('missing', 30_000)).toBeNull()

    store.set('lkt_runs_v1', '{')
    expect(loadRuns()).toEqual([])
    store.set('lkt_runs_v1', JSON.stringify({ not: 'an array' }))
    expect(loadRuns()).toEqual([])
  })

  it('appends a run, trims the history at 5000, and survives a failed write', () => {
    const row: RunResult = {
      exercise_id: 'fresh',
      mode: 'focus',
      timestamp: 20,
      wpm: 22,
      accuracy: 0.95,
      errors: 1,
      backspaces: 1,
      duration_ms: 1_000,
    }
    expect(appendRun(row)).toBe(true)
    expect(loadRuns()[0]).toMatchObject({ exercise_id: 'fresh', v: 2 })

    const many = Array.from({ length: 5_000 }, (_, index) => ({
      exercise_id: `e${index}`,
      mode: 'focus' as const,
      timestamp: index,
      wpm: 1,
      accuracy: 1,
      errors: 0,
      backspaces: 0,
      duration_ms: 1,
    }))
    store.set('lkt_runs_v1', JSON.stringify(many))
    expect(appendRun({ ...row, exercise_id: 'newest', timestamp: 99_000 })).toBe(true)
    const trimmed = loadRuns()
    expect(trimmed).toHaveLength(5_000)
    expect(trimmed[trimmed.length - 1].exercise_id).toBe('newest')
    expect(trimmed.some((item) => item.exercise_id === 'e0')).toBe(false)
    expect(trimmed.some((item) => item.exercise_id === 'e1')).toBe(true)

    store.clear()
    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(appendRun(row)).toBe(false)
    expect(store.has('lkt_runs_v1')).toBe(false)
  })

  it('loads partial recents and keeps the newest 200 ids', () => {
    expect(loadRecents().byMode).toEqual({ focus: [], real_life: [], competitive: [] })
    store.set('lkt_recents_v1', '"hello"')
    expect(loadRecents().byMode.focus).toEqual([])
    store.set('lkt_recents_v1', JSON.stringify({ byMode: null }))
    expect(loadRecents().byMode.real_life).toEqual([])
    store.set('lkt_recents_v1', JSON.stringify({ byMode: [] }))
    expect(loadRecents().byMode.competitive).toEqual([])
    store.set(
      'lkt_recents_v1',
      JSON.stringify({ byMode: { focus: ['a', 1, 'a'], real_life: 'no', competitive: [] } }),
    )
    expect(loadRecents().byMode.focus).toEqual(['a', 'a'])
    expect(loadRecents().byMode.real_life).toEqual([])

    expect(pushRecent('focus', 'b')).toBe(true)
    expect(loadRecents().byMode.focus.slice(0, 2)).toEqual(['b', 'a'])
    pushRecent('real_life', 'same')
    pushRecent('real_life', 'same')
    expect(loadRecents().byMode.real_life).toEqual(['same'])

    const ids = Array.from({ length: 200 }, (_, index) => `id-${index}`)
    store.set('lkt_recents_v1', JSON.stringify({ byMode: { focus: ids, real_life: [], competitive: [] } }))
    expect(pushRecent('focus', 'id-new')).toBe(true)
    const capped = loadRecents().byMode.focus
    expect(capped).toHaveLength(200)
    expect(capped[0]).toBe('id-new')
    expect(capped).not.toContain('id-199')
    expect(capped).toContain('id-198')
    expect(pushRecent('focus', 'id-new')).toBe(true)
    const deduped = loadRecents().byMode.focus
    expect(deduped).toHaveLength(200)
    expect(deduped[0]).toBe('id-new')
    expect(deduped.filter((id) => id === 'id-new')).toHaveLength(1)

    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(pushRecent('competitive', 'nope')).toBe(false)
  })

  it('stores personal bests per sprint and skips a best that fails the accuracy bar', () => {
    store.set(
      'lkt_pbs_v1',
      JSON.stringify({
        byKey: {
          bad: null,
          empty: { exercise_id: '', wpm: 1, accuracy: 1, timestamp: 1 },
          text: { exercise_id: 'e', wpm: 'fast', accuracy: 1, timestamp: 1 },
          badSprint: { exercise_id: 'e', wpm: 1, accuracy: 1, timestamp: 1, sprint_duration_ms: 15_000 },
          'e|0': { exercise_id: 'e', wpm: 12, accuracy: 0.97, timestamp: 5 },
          'e2|30000': { exercise_id: 'e2', wpm: 15, accuracy: 0.96, timestamp: 6, sprint_duration_ms: 30_000 },
          'e2|60000': { exercise_id: 'e2', wpm: 16, accuracy: 0.97, timestamp: 7, sprint_duration_ms: 60_000 },
          'e2|120000': { exercise_id: 'e2', wpm: 20, accuracy: 0.99, timestamp: 8, sprint_duration_ms: 120_000 },
        },
      }),
    )
    const loaded = loadPersonalBests()
    expect(loaded.byKey.bad).toBeUndefined()
    expect(loaded.byKey.badSprint).toBeUndefined()
    expect(loaded.byKey['e|0'].sprint_duration_ms).toBeUndefined()
    expect(getPersonalBest('e')).toMatchObject({ wpm: 12, accuracy: 0.97 })
    expect(getPersonalBest('e2', 30_000)?.wpm).toBe(15)
    expect(getPersonalBest('e2', 60_000)?.wpm).toBe(16)
    expect(getPersonalBest('e2', 120_000)?.wpm).toBe(20)
    expect(getPersonalBest('missing')).toBeNull()

    store.set('lkt_pbs_v1', '[]')
    expect(loadPersonalBests().byKey).toEqual({})
    store.set('lkt_pbs_v1', JSON.stringify({ byKey: [] }))
    expect(loadPersonalBests().byKey).toEqual({})
    store.set('lkt_pbs_v1', '{}')
    expect(getPersonalBest('e')).toBeNull()
    store.set('lkt_pbs_v1', '{')
    expect(loadPersonalBests().byKey).toEqual({})

    store.delete('lkt_pbs_v1')
    const rejected = maybeUpdatePersonalBest({
      exerciseId: 'sprint',
      sprintDurationMs: 30_000,
      wpm: 80,
      accuracy: 0.94,
      timestamp: 1,
    })
    expect(rejected).toEqual({ updated: false, previous: null })

    const created = maybeUpdatePersonalBest({
      exerciseId: 'sprint',
      sprintDurationMs: 30_000,
      wpm: 10,
      accuracy: 0.95,
      timestamp: 2,
    })
    expect(created.updated).toBe(true)
    expect(created.previous).toBeNull()

    const tied = maybeUpdatePersonalBest({
      exerciseId: 'sprint',
      sprintDurationMs: 30_000,
      wpm: 10,
      accuracy: 0.99,
      timestamp: 3,
    })
    expect(tied.updated).toBe(false)
    expect(tied.previous).toMatchObject({ wpm: 10 })

    const faster = maybeUpdatePersonalBest({
      exerciseId: 'sprint',
      sprintDurationMs: 30_000,
      wpm: 11,
      accuracy: 0.96,
      timestamp: 4,
    })
    expect(faster).toMatchObject({ updated: true, previous: expect.objectContaining({ wpm: 10 }) })

    const lowAccuracy = maybeUpdatePersonalBest({
      exerciseId: 'sprint',
      sprintDurationMs: 30_000,
      wpm: 50,
      accuracy: 0.94,
      timestamp: 5,
    })
    expect(lowAccuracy.updated).toBe(false)
    expect(lowAccuracy.previous?.wpm).toBe(11)
    expect(getPersonalBest('sprint', 60_000)).toBeNull()
    expect(getPersonalBest('sprint')).toBeNull()

    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    const failedWrite = maybeUpdatePersonalBest({
      exerciseId: 'sprint',
      sprintDurationMs: 30_000,
      wpm: 40,
      accuracy: 0.99,
      timestamp: 6,
    })
    expect(failedWrite.updated).toBe(true)
    expect(failedWrite.previous?.wpm).toBe(11)
    expect(getPersonalBest('sprint', 30_000)?.wpm).toBe(11)
  })

  it('creates a user id, fills a partial skill document, and migrates version 1', () => {
    expect(getOrCreateUserId()).toMatch(/^u_[a-z0-9]{20}$/)
    const created = store.get('lkt_user_id_v1')
    expect(getOrCreateUserId()).toBe(created)
    store.set('lkt_user_id_v1', 'abcdefg')
    expect(getOrCreateUserId()).toMatch(/^u_[a-z0-9]{20}$/)
    expect(getOrCreateUserId()).not.toBe('abcdefg')
    store.set('lkt_user_id_v1', 'abcdefgh')
    expect(getOrCreateUserId()).toBe('abcdefgh')

    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(getOrCreateUserId()).toBe('abcdefgh')
    store.set('lkt_user_id_v1', 'short')
    const unsaved = getOrCreateUserId()
    expect(unsaved).toMatch(/^u_[a-z0-9]{20}$/)
    expect(store.get('lkt_user_id_v1')).toBe('short')
    storage.setItem = (key: string, value: string) => {
      store.set(key, value)
    }

    store.delete('lkt_skill_v1')
    const fresh = loadSkillModel()
    expect(fresh.version).toBe(2)
    expect(fresh.total_runs).toBe(0)
    expect(fresh.performance_by_length.multiline.runs).toBe(0)
    expect(JSON.parse(store.get('lkt_skill_v1') ?? '{}').version).toBe(2)

    let writes = 0
    const record = storage.setItem.bind(storage)
    storage.setItem = (key: string, value: string) => {
      writes += 1
      record(key, value)
    }
    const complete = skillShell({ total_runs: 4 })
    store.set('lkt_skill_v1', JSON.stringify({ ...complete, note: 'keep' }))
    writes = 0
    const kept = loadSkillModel()
    expect(kept.total_runs).toBe(4)
    expect(kept.performance_by_length.short.ema_wpm).toBe(0)
    expect(writes).toBe(0)
    expect(JSON.parse(store.get('lkt_skill_v1') ?? '{}').note).toBe('keep')

    store.set('lkt_skill_v1', JSON.stringify({ version: 2, total_runs: '4', performance_by_length: null }))
    const filled = loadSkillModel()
    expect(filled.total_runs).toBe(0)
    expect(filled.performance_by_length.short).toEqual(lengthBucket())
    expect(filled.performance_by_length.long.runs).toBe(0)

    store.set(
      'lkt_skill_v1',
      JSON.stringify({
        version: 2,
        total_runs: 6,
        performance_by_length: {
          short: { ema_wpm: 42, ema_accuracy: 0.9, ema_backspace_rate: 0.1, runs: 3 },
          medium: { ema_wpm: 1 },
        },
      }),
    )
    const partial = loadSkillModel()
    expect(partial.total_runs).toBe(6)
    expect(partial.performance_by_length.short.ema_wpm).toBe(42)
    expect(partial.performance_by_length.medium).toEqual(lengthBucket())
    expect(partial.performance_by_length.multiline.ema_accuracy).toBe(1)

    store.set('lkt_skill_v1', JSON.stringify({ version: 2, performance_by_length: [] }))
    expect(loadSkillModel().performance_by_length.short.runs).toBe(0)
    store.set('lkt_skill_v1', JSON.stringify({ version: 2, performance_by_length: 'x' }))
    expect(loadSkillModel().total_runs).toBe(0)

    storage.setItem = () => {
      throw new Error('quota')
    }
    store.set('lkt_skill_v1', JSON.stringify({ version: 2 }))
    const repairedAnyway = loadSkillModel()
    expect(repairedAnyway.performance_by_length.short.runs).toBe(0)
    expect(store.get('lkt_skill_v1')).toBe(JSON.stringify({ version: 2 }))

    store.set('lkt_skill_v1', '{')
    const replaced = loadSkillModel()
    expect(replaced.version).toBe(2)
    expect(store.get('lkt_skill_v1')).toBe('{')

    storage.setItem = (key: string, value: string) => {
      store.set(key, value)
    }
    const weak = Array.from({ length: 14 }, (_, index) => `t${index}`)
    store.set(
      'lkt_skill_v1',
      JSON.stringify({
        version: 1,
        updated_at: '2020-01-01T00:00:00.000Z',
        total_runs: 4,
        ema: { wpm: 10, accuracy: 0.9, backspace_rate: 0.1 },
        errors_by_class: { letters: 2 },
        performance_by_length: skillShell().performance_by_length,
        weak_tags: weak,
      }),
    )
    const migrated = loadSkillModel()
    expect(migrated.version).toBe(2)
    expect(migrated.total_runs).toBe(4)
    expect(migrated.ema.wpm).toBe(10)
    expect(migrated.errors_by_class.letters).toBe(2)
    expect(migrated.weak_tags).toHaveLength(12)
    expect(migrated.weak_tags).not.toContain('t13')
    expect(migrated.weakness_by_tag.t0).toBe(0.25)
    expect(migrated.weakness_by_tag.t13).toBe(0.25)
    expect(JSON.parse(store.get('lkt_skill_v1') ?? '{}').version).toBe(2)

    store.set('lkt_skill_v1', JSON.stringify({ version: 1, total_runs: Number.NaN }))
    const sparse = loadSkillModel()
    expect(sparse.total_runs).toBe(0)
    expect(sparse.weak_tags).toEqual([])
    expect(sparse.weakness_by_tag).toEqual({})
    expect(sparse.ema.accuracy).toBe(1)
    expect(sparse.updated_at).toContain('T')
    expect(sparse.performance_by_length.short.runs).toBe(0)

    storage.setItem = () => {
      throw new Error('quota')
    }
    store.set('lkt_skill_v1', JSON.stringify({ version: 1, total_runs: 2, weak_tags: ['quotes'] }))
    const unsavedMigration = loadSkillModel()
    expect(unsavedMigration.version).toBe(2)
    expect(unsavedMigration.total_runs).toBe(2)
    expect(unsavedMigration.weakness_by_tag.quotes).toBe(0.25)
    expect(store.get('lkt_skill_v1')).toContain('"version":1')

    store.delete('lkt_skill_v1')
    const unsavedFresh = loadSkillModel()
    expect(unsavedFresh.total_runs).toBe(0)
    expect(store.has('lkt_skill_v1')).toBe(false)

    storage.setItem = (key: string, value: string) => {
      store.set(key, value)
    }
    const custom = skillShell({ total_runs: 9 })
    saveSkillModel(custom)
    expect(loadSkillModel().total_runs).toBe(9)
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(() => saveSkillModel(skillShell({ total_runs: 1 }))).not.toThrow()
    expect(JSON.parse(store.get('lkt_skill_v1') ?? '{}').total_runs).toBe(9)

    storage.getItem = () => {
      throw new Error('blocked')
    }
    expect(loadRuns()).toEqual([])
    expect(loadLastMode()).toBeNull()
    expect(loadRecents().byMode.focus).toEqual([])
    expect(loadPersonalBests().byKey).toEqual({})
    expect(getPersonalBest('x')).toBeNull()
    expect(loadPreferences().volume).toBe(0.5)
    expect(loadSkillModel().version).toBe(2)
  })
})

describe('recommendations', () => {
  it('clamps the count, repeats a seed, and stays inside a screen-reader-safe pool', () => {
    const prefs = { screenReaderMode: false }
    expect(publicLib.getNextRecommendations({ mode: 'focus', seed: 'count-8' }, prefs)).toHaveLength(5)
    expect(publicLib.getNextRecommendations({ mode: 'focus', count: 0, seed: 'count-0' }, prefs)).toHaveLength(1)
    expect(publicLib.getNextRecommendations({ mode: 'focus', count: 100, seed: 'count-100' }, prefs)).toHaveLength(8)
    expect(publicLib.getNextRecommendations({ mode: 'focus', count: 5.2, seed: 'count-floor' }, prefs)).toHaveLength(5)

    const first = publicLib.getNextRecommendations({ mode: 'focus', count: 3, seed: 'same-seed' }, prefs)
    const second = publicLib.getNextRecommendations({ mode: 'focus', count: 3, seed: 'same-seed' }, prefs)
    expect(second).toEqual(first)
    expect(new Set(first.map((row) => row.exerciseId)).size).toBe(3)

    const safe = publicLib.getNextRecommendations(
      { mode: 'focus', count: 5, seed: 'sr-real' },
      { screenReaderMode: true },
    )
    expect(safe.length).toBeGreaterThan(0)
    for (const row of safe) {
      const exercise = findExercise(row.exerciseId)
      expect(exercise && isScreenReaderSafePassage(exercise)).toBe(true)
    }

    const recentIds = loadExercisesByMode('focus').slice(0, 30).map((exercise) => exercise.id)
    const avoided = publicLib.getNextRecommendations(
      {
        mode: 'focus',
        count: 5,
        seed: 'avoid-recent',
        skill: {
          total_runs: 10,
          ema: { wpm: 40, accuracy: 1, backspace_rate: 0 },
          by_mode: skillShell().by_mode,
          weak_tags: ['calm'],
          weakness_by_tag: { calm: 0.5 },
          recent_exercise_ids_by_mode: { focus: recentIds, real_life: [], competitive: [] },
        },
      },
      prefs,
    )
    expect(avoided.every((row) => !recentIds.includes(row.exerciseId))).toBe(true)
  })

  it('explains a matched tag, skips a recent id, and stops when the pool runs out', () => {
    const tagged = recExercise('tagged', {
      tags: ['calm', 'focus', 'sentences', 'numbers'],
      difficulty: 1,
    })
    gates.override = () => [tagged]
    const targeted = publicLib.getNextRecommendations(
      {
        mode: 'focus',
        count: 4,
        seed: 'targets',
        skill: {
          total_runs: 12,
          ema: { wpm: 70, accuracy: 1, backspace_rate: 0 },
          by_mode: skillShell().by_mode,
          weak_tags: ['calm', 'focus', 'sentences', 'numbers', 'extra'],
          weakness_by_tag: { calm: 2, focus: 0 },
          recent_exercise_ids_by_mode: { focus: [], real_life: [], competitive: [] },
        },
      },
      { screenReaderMode: false },
    )
    expect(targeted).toHaveLength(1)
    expect(targeted[0].reasonTags).toEqual(['calm', 'focus', 'sentences'])
    expect(targeted[0].reasonText).toBe('Targets: calm, focus, sentences (and stays near your current band).')

    gates.override = () => [recExercise('plain', { tags: ['calm'] })]
    const variety = publicLib.getNextRecommendations(
      {
        mode: 'focus',
        count: 1,
        seed: 'variety',
        skill: {
          total_runs: 9,
          weak_tags: ['nope'],
          weakness_by_tag: {},
          ema: { wpm: 40, accuracy: 1, backspace_rate: 0 },
          by_mode: skillShell().by_mode,
          recent_exercise_ids_by_mode: { focus: [], real_life: [], competitive: [] },
        },
      },
      { screenReaderMode: false },
    )
    expect(variety[0].reasonText).toBe('Stays near your current band with variety.')
    expect(variety[0].reasonTags).toEqual([])

    const older = Array.from({ length: 30 }, (_, index) => `other-${index}`)
    gates.override = () => [recExercise('keep-me')]
    const kept = publicLib.getNextRecommendations(
      {
        mode: 'focus',
        count: 3,
        seed: 'slice-30',
        skill: {
          total_runs: 8,
          weak_tags: [],
          weakness_by_tag: {},
          ema: { wpm: 40, accuracy: 1, backspace_rate: 0 },
          by_mode: skillShell().by_mode,
          recent_exercise_ids_by_mode: {
            focus: [...older, 'keep-me'],
            real_life: [],
            competitive: [],
          },
        },
      },
      { screenReaderMode: false },
    )
    expect(kept.map((row) => row.exerciseId)).toEqual(['keep-me'])

    gates.override = () => [recExercise('drop-me'), recExercise('keep-me', { difficulty: 5 })]
    const remaining = publicLib.getNextRecommendations(
      {
        mode: 'focus',
        count: 5,
        seed: 'drop',
        skill: {
          total_runs: 8,
          recent_exercise_ids_by_mode: { focus: ['drop-me'], real_life: [], competitive: [] },
        },
      },
      { screenReaderMode: false },
    )
    expect(remaining.map((row) => row.exerciseId)).toEqual(['keep-me'])

    const template = recExercise('template-row', {
      type: 'template',
      template: 'Hi {name}',
      slots: { name: ['Ada'] },
      tags: ['calm'],
      difficulty: 2,
    })
    gates.override = () => [template, recExercise('static-row', { difficulty: 4, tags: ['numbers'] })]
    const both = publicLib.getNextRecommendations({ mode: 'focus', count: 2, seed: 'both' }, { screenReaderMode: false })
    expect(both.map((row) => row.exerciseId).sort()).toEqual(['static-row', 'template-row'])

    const unsafe = recExercise('unsafe-row', { text: 'x'.repeat(200), text_short: 'x'.repeat(200) })
    gates.override = () => [unsafe, recExercise('safe-row', { text: 'Short line.', text_short: 'Short line.' })]
    const onlySafe = publicLib.getNextRecommendations(
      { mode: 'focus', count: 4, seed: 'sr-filter' },
      { screenReaderMode: true },
    )
    expect(onlySafe.map((row) => row.exerciseId)).toEqual(['safe-row'])

    gates.override = () => [unsafe]
    expect(
      publicLib.getNextRecommendations({ mode: 'focus', count: 3, seed: 'sr-empty' }, { screenReaderMode: true }),
    ).toEqual([])

    gates.override = () => []
    expect(publicLib.getNextRecommendations({ mode: 'focus', count: 3, seed: 'none' }, { screenReaderMode: false })).toEqual(
      [],
    )

    gates.override = () => [recExercise('only-a'), recExercise('only-b')]
    expect(publicLib.getNextRecommendations({ mode: 'focus', count: 8, seed: 'two' }, { screenReaderMode: false })).toHaveLength(
      2,
    )
  })

  it('reads every pace band from the skill document', () => {
    gates.override = null
    const prefs = { screenReaderMode: false }
    const bands = [20, 40, 50, 70, 90]
    for (const wpm of bands) {
      const rows = publicLib.getNextRecommendations(
        {
          mode: 'focus',
          count: 1,
          seed: `band-${wpm}`,
          skill: {
            total_runs: 10,
            ema: { wpm, accuracy: 1, backspace_rate: 0 },
            by_mode: {
              focus: { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs: 4 },
              real_life: { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs: 4 },
              competitive: { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs: 4 },
            },
            weak_tags: ['sentences'],
            weakness_by_tag: { sentences: 0.3 },
          },
        },
        prefs,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].exerciseId.length).toBeGreaterThan(0)
    }

    expect(
      publicLib.getNextRecommendations(
        { mode: 'focus', count: 1, seed: 'few-runs', skill: { total_runs: 2, ema: { wpm: 90, accuracy: 1, backspace_rate: 0 } } },
        prefs,
      ),
    ).toHaveLength(1)
    expect(
      publicLib.getNextRecommendations(
        {
          mode: 'focus',
          count: 1,
          seed: 'nan-runs',
          skill: { total_runs: Number.NaN, ema: { wpm: 10, accuracy: 1, backspace_rate: 0 } },
        },
        prefs,
      ),
    ).toHaveLength(1)
    expect(publicLib.getNextRecommendations({ mode: 'real_life', count: 1, seed: 'no-skill' }, prefs)).toHaveLength(1)
    expect(
      publicLib.getNextRecommendations(
        {
          mode: 'competitive',
          count: 1,
          seed: 'ema-only',
          skill: {
            total_runs: 10,
            ema: { wpm: 20, accuracy: 1, backspace_rate: 0 },
            by_mode: {} as UserSkillModel['by_mode'],
          },
        },
        prefs,
      ),
    ).toHaveLength(1)
    expect(
      publicLib.getNextRecommendations(
        {
          mode: 'focus',
          count: 1,
          seed: 'nan-wpm',
          skill: {
            total_runs: 10,
            ema: { wpm: Number.NaN, accuracy: 1, backspace_rate: 0 },
            by_mode: {} as UserSkillModel['by_mode'],
          },
        },
        prefs,
      ),
    ).toHaveLength(1)
    expect(
      publicLib.getNextRecommendations(
        {
          mode: 'focus',
          count: 1,
          seed: 'no-ema',
          skill: { total_runs: 10, by_mode: {} as UserSkillModel['by_mode'] },
        },
        prefs,
      ),
    ).toHaveLength(1)
  })
})

describe('daily set', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('builds each session length, a local day key, and a screen-reader set', () => {
    const now = new Date()
    const localKey = [
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
    const today = publicLib.generateDailySet({ userId: 'daily-local-cov', sessionType: 'mix' })
    expect(today.dateKey).toBe(localKey)
    expect(today.items).toHaveLength(8)

    const reset = publicLib.generateDailySet({
      userId: 'daily-reset',
      dateKey: '2026-10-03',
      sessionType: 'reset',
      weakTags: ['calm'],
    })
    expect(reset.items).toHaveLength(5)
    expect(reset.items.some((item) => item.kind === 'challenge')).toBe(false)
    expect(reset.items.some((item) => item.kind === 'confidence')).toBe(true)
    expect(reset.items.some((item) => item.kind === 'real_life')).toBe(true)
    expect(reset.items.some((item) => item.kind === 'targeted')).toBe(true)

    const mix = publicLib.generateDailySet({
      userId: 'daily-mix',
      dateKey: '2026-10-03',
      sessionType: 'mix',
      weakTags: ['calm', 'sentences'],
    })
    expect(mix.items).toHaveLength(8)
    expect(mix.items.some((item) => item.kind === 'challenge')).toBe(true)

    const deep = publicLib.generateDailySet({
      userId: 'daily-deep',
      dateKey: '2026-10-04',
      sessionType: 'deep',
    })
    expect(deep.items).toHaveLength(10)

    const screenReader = publicLib.generateDailySet({
      userId: 'daily-sr',
      dateKey: '2026-09-01',
      sessionType: 'reset',
      screenReaderMode: true,
    })
    publicLib.generateDailySet({
      userId: 'daily-sr',
      dateKey: '2026-09-01',
      sessionType: 'reset',
      screenReaderMode: false,
    })
    expect(store.has('lkt_daily_set_v1|daily-sr|2026-09-01|reset|sr')).toBe(true)
    expect(store.has('lkt_daily_set_v1|daily-sr|2026-09-01|reset')).toBe(true)
    expect(screenReader.items.length).toBeGreaterThan(0)
    for (const item of screenReader.items) {
      const exercise = findExercise(item.exerciseId)
      expect(exercise && isScreenReaderSafePassage(exercise)).toBe(true)
    }
  })

  it('uses the cached set, rejects a bad cache, and still returns a set when storage throws', () => {
    const args = {
      userId: 'cache-user',
      dateKey: '2026-08-01',
      sessionType: 'mix' as const,
    }
    publicLib.generateDailySet(args)
    const key = 'lkt_daily_set_v1|cache-user|2026-08-01|mix'
    const stored = JSON.parse(store.get(key) ?? '{}') as { items: unknown }
    stored.items = [{ kind: 'mix', mode: 'focus', exerciseId: 'sentinel-id' }]
    store.set(key, JSON.stringify(stored))
    expect(publicLib.generateDailySet({ ...args, weakTags: ['zzz'] }).items).toEqual(stored.items)

    store.set(key, JSON.stringify({ ...stored, userId: 'other' }))
    expect(publicLib.generateDailySet(args).userId).toBe('cache-user')
    expect(publicLib.generateDailySet(args).items).not.toEqual(stored.items)

    const mismatchKey = 'lkt_daily_set_v1|date-mismatch|2026-08-02|reset'
    store.set(
      mismatchKey,
      JSON.stringify({
        userId: 'date-mismatch',
        dateKey: '1999-01-01',
        sessionType: 'reset',
        items: [],
      }),
    )
    expect(publicLib.generateDailySet({ userId: 'date-mismatch', dateKey: '2026-08-02', sessionType: 'reset' }).items.length).toBe(
      5,
    )

    const sessionKey = 'lkt_daily_set_v1|session-mismatch|2026-08-03|reset'
    store.set(
      sessionKey,
      JSON.stringify({
        userId: 'session-mismatch',
        dateKey: '2026-08-03',
        sessionType: 'mix',
        items: [],
      }),
    )
    expect(
      publicLib.generateDailySet({ userId: 'session-mismatch', dateKey: '2026-08-03', sessionType: 'reset' }).items,
    ).toHaveLength(5)

    store.set(
      'lkt_daily_set_v1|items-mismatch|2026-08-04|reset',
      JSON.stringify({
        userId: 'items-mismatch',
        dateKey: '2026-08-04',
        sessionType: 'reset',
        items: null,
      }),
    )
    expect(publicLib.generateDailySet({ userId: 'items-mismatch', dateKey: '2026-08-04', sessionType: 'reset' }).items).toHaveLength(
      5,
    )

    store.set('lkt_daily_set_v1|bad-json|2026-08-05|reset', '{')
    expect(publicLib.generateDailySet({ userId: 'bad-json', dateKey: '2026-08-05', sessionType: 'reset' }).items).toHaveLength(5)
    store.set('lkt_daily_set_v1|empty-raw|2026-08-06|reset', '')
    expect(publicLib.generateDailySet({ userId: 'empty-raw', dateKey: '2026-08-06', sessionType: 'reset' }).items).toHaveLength(5)

    const storage = globalThis.localStorage
    storage.getItem = () => {
      throw new Error('blocked')
    }
    expect(publicLib.generateDailySet({ userId: 'throw-get', dateKey: '2026-06-06', sessionType: 'reset' }).items).toHaveLength(
      5,
    )

    storage.getItem = (key: string) => (store.has(key) ? store.get(key)! : null)
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(() =>
      publicLib.generateDailySet({ userId: 'throw-set', dateKey: '2026-11-11', sessionType: 'reset' }),
    ).not.toThrow()
    expect(store.has('lkt_daily_set_v1|throw-set|2026-11-11|reset')).toBe(false)
  })

  it('walks the pace bands and relaxes a pool that was fully avoided', () => {
    const paces = [
      { id: 'none', skill: undefined },
      { id: 'nan', skill: { total_runs: Number.NaN, ema: { wpm: 10, accuracy: 1, backspace_rate: 0 } } },
      { id: 'few', skill: { total_runs: 2, ema: { wpm: 80, accuracy: 1, backspace_rate: 0 } } },
      { id: 'w0', skill: { total_runs: 10, ema: { wpm: Number.NaN, accuracy: 1, backspace_rate: 0 } } },
      { id: 'w20', skill: { total_runs: 10, ema: { wpm: 20, accuracy: 1, backspace_rate: 0 } } },
      { id: 'w40', skill: { total_runs: 10, ema: { wpm: 40, accuracy: 1, backspace_rate: 0 } } },
      { id: 'w50', skill: { total_runs: 10, ema: { wpm: 50, accuracy: 1, backspace_rate: 0 } } },
      { id: 'w70', skill: { total_runs: 10, ema: { wpm: 70, accuracy: 1, backspace_rate: 0 } } },
      { id: 'w80', skill: { total_runs: 10, ema: { wpm: 80, accuracy: 1, backspace_rate: 0 } } },
      { id: 'missing-ema', skill: { total_runs: 10 } },
    ] as const
    for (const pace of paces) {
      const set = publicLib.generateDailySet({
        userId: `pace-${pace.id}`,
        dateKey: '2026-01-15',
        sessionType: 'reset',
        skill: pace.skill as never,
      })
      expect(set.items.length).toBeGreaterThan(0)
    }

    const heavy = recExercise('avoided-passage', {
      text: 'Heavy line.',
      text_short: 'Heavy line.',
      difficulty: 1,
    })
    const light = recExercise('kept-passage', {
      text: 'Light line.',
      text_short: 'Light line.',
      difficulty: 5,
      tags: ['numbers'],
    })
    const dailySkill = {
      total_runs: 6,
      ema: { wpm: 48, accuracy: 1, backspace_rate: 0 },
    }
    // These ids make the confidence roll prefer difficulty 1, then the filler hits an empty mode
    // before relaxation can repeat the focus passage.
    function dailyFromFocusPool(userId: string, recentFocus: string[], pool: Exercise[]) {
      let focusLoads = 0
      gates.override = (mode: 'focus' | 'real_life' | 'competitive') => {
        if (mode !== 'focus') return []
        focusLoads += 1
        return pool
      }
      const set = publicLib.generateDailySet({
        userId,
        dateKey: '2026-01-16',
        sessionType: 'reset',
        skill: {
          ...dailySkill,
          recent_exercise_ids_by_mode: {
            focus: recentFocus,
            real_life: undefined as unknown as string[],
            competitive: [],
          },
        },
      })
      return { set, focusLoads }
    }

    const partial = dailyFromFocusPool('novelty-hold-0', ['avoided-passage'], [heavy, light])
    expect(partial.focusLoads).toBe(1)
    expect(partial.set.items.map((item) => item.exerciseId)).toEqual(['kept-passage'])

    const exhausted = dailyFromFocusPool('novelty-hold-3', ['avoided-passage', 'kept-passage'], [heavy, light])
    // The strict focus pick finds nothing, so the fallback has to load the pool again.
    expect(exhausted.focusLoads).toBe(2)
    expect(exhausted.set.items[0]).toMatchObject({ kind: 'confidence', exerciseId: 'avoided-passage' })
    expect(exhausted.set.items.length).toBeGreaterThan(0)
    expect(
      exhausted.set.items.every(
        (item) => item.exerciseId === 'avoided-passage' || item.exerciseId === 'kept-passage',
      ),
    ).toBe(true)

    const safe = recExercise('safe-a', { text: 'Short line.', text_short: 'Short line.', difficulty: 1 })

    const unsafe = recExercise('unsafe-daily', { text: 'y'.repeat(180), text_short: 'y'.repeat(180) })
    gates.override = () => [safe, unsafe]
    const screenReader = publicLib.generateDailySet({
      userId: 'sr-filter-daily',
      dateKey: '2026-01-17',
      sessionType: 'mix',
      screenReaderMode: true,
    })
    expect(screenReader.items.length).toBeGreaterThan(0)
    expect(screenReader.items.every((item) => item.exerciseId === 'safe-a')).toBe(true)
  })

  it('falls back when every strict pick misses, including an empty catalog', () => {
    gates.override = () => []
    expect(
      publicLib.generateDailySet({
        userId: 'empty-catalog',
        dateKey: '2026-04-01',
        sessionType: 'reset',
        screenReaderMode: true,
      }).items,
    ).toEqual([])

    const one = loadExercisesByMode('focus')[0]
    let sawItem = false
    let sawEmpty = false
    for (let i = 0; i < 24; i++) {
      let focusLoads = 0
      gates.override = (mode) => {
        if (mode !== 'focus') return []
        focusLoads += 1
        return focusLoads >= 5 ? [one] : []
      }
      const set = publicLib.generateDailySet({
        userId: `fallback-${i}`,
        dateKey: '2026-02-02',
        sessionType: 'reset',
      })
      if (set.items.length === 0) sawEmpty = true
      if (set.items.length === 1 && set.items[0].exerciseId === one.id && set.items[0].kind === 'mix') sawItem = true
    }
    expect(sawItem).toBe(true)
    expect(sawEmpty).toBe(true)
  })

  it('keeps a bad or mismatched legacy progress blob and still migrates a matching one', () => {
    const matching = {
      dateKey: '2026-10-03',
      userId: 'daily-user',
      sessionType: 'reset' as const,
      completedItems: [{ wpm: 40, accuracy: 0.98, durationMs: 1000, completedAt: 1 }],
      startedAt: 1,
    }
    const key = `lkt_daily_progress_v1|${matching.userId}|${matching.dateKey}|reset`

    expect(publicLib.saveDailyProgress(matching, false)).toBe(true)
    expect(publicLib.saveDailyProgress({ ...matching, startedAt: 9 }, true)).toBe(true)
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)?.startedAt).toBe(1)
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', true)?.startedAt).toBe(9)
    store.delete(key)
    store.delete(`${key}|sr`)

    store.set(key, '{')
    store.set('lkt_daily_progress', JSON.stringify(matching))
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.get('lkt_daily_progress')).toBe(JSON.stringify(matching))

    store.set(key, JSON.stringify({ ...matching, userId: 'other', completedItems: [] }))
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.has('lkt_daily_progress')).toBe(true)

    store.delete(key)
    store.set(key, '')
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.has('lkt_daily_progress')).toBe(true)

    store.delete(key)
    store.set('lkt_daily_progress', '{')
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.get('lkt_daily_progress')).toBe('{')

    store.set('lkt_daily_progress', JSON.stringify({ ...matching, sessionType: 'deep' }))
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.has('lkt_daily_progress')).toBe(true)

    store.set('lkt_daily_progress', JSON.stringify({ ...matching, completedItems: 'no' }))
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.has('lkt_daily_progress')).toBe(true)

    store.set('lkt_daily_progress', JSON.stringify(matching))
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toEqual(matching)
    expect(store.has('lkt_daily_progress')).toBe(false)
    expect(JSON.parse(store.get(key) ?? 'null')).toEqual(matching)

    store.clear()
    store.set('lkt_daily_progress', JSON.stringify(matching))
    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(store.get('lkt_daily_progress')).toBe(JSON.stringify(matching))
    expect(publicLib.saveDailyProgress(matching, false)).toBe(false)

    storage.getItem = () => {
      throw new Error('blocked')
    }
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'mix', true)).toBeNull()

    Reflect.deleteProperty(globalThis, 'localStorage')
    expect(publicLib.loadDailyProgress(matching.dateKey, matching.userId, 'reset', false)).toBeNull()
    expect(publicLib.saveDailyProgress(matching, true)).toBe(false)
    const detached = publicLib.generateDailySet({
      userId: 'no-store',
      dateKey: '2026-07-07',
      sessionType: 'deep',
    })
    expect(detached.dateKey).toBe('2026-07-07')
    expect(detached.items).toHaveLength(10)
    installMemoryStorage()
  })
})

describe('content engine', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('pads competitive text by sprint length and renders every text shape', () => {
    expect(competitiveMinLength(undefined)).toBe(1800)
    expect(competitiveMinLength(30_000)).toBe(1800)
    expect(competitiveMinLength(60_000)).toBe(1800)
    expect(competitiveMinLength(120_000)).toBe(4000)

    const prefs = sanitizePreferences(null)
    const passage = recExercise('short-comp', {
      mode: 'competitive',
      text_short: 'Hi there.',
      text: 'Hi there.',
      tags: ['competitive'],
    })
    gates.override = () => [passage]

    const lengths: Array<[number | undefined, number]> = [
      [undefined, 1809],
      [30_000, 1809],
      [60_000, 1809],
      [120_000, 4009],
    ]
    for (const [duration, length] of lengths) {
      const result = publicLib.pickNextExercise({
        mode: 'competitive',
        userId: `len-${String(duration)}`,
        skill: null,
        prefs: {
          ...prefs,
          competitiveSprintDurationMs: duration as Preferences['competitiveSprintDurationMs'],
        },
      })
      expect(result.renderedText.length).toBe(length)
      expect(result.renderedText.startsWith('Hi there.')).toBe(true)
    }

    const screenReader = publicLib.pickNextExercise({
      mode: 'competitive',
      userId: 'len-sr',
      skill: null,
      prefs: sanitizePreferences({ screenReaderMode: true }),
    })
    expect(screenReader.renderedText).toBe('Hi there.')

    gates.override = () => [
      {
        id: 'from-text',
        mode: 'focus',
        pack: 'p',
        title: 't',
        difficulty: 1,
        estimated_seconds: 20,
        tags: ['calm'],
        text: 'From text',
        text_long: 'Long form line',
      },
    ]
    expect(
      publicLib.pickNextExercise({
        mode: 'focus',
        userId: 'from-text',
        skill: null,
        prefs,
      }).renderedText,
    ).toBe('From text')

    gates.override = () => [
      {
        id: 'long-only',
        mode: 'focus',
        pack: 'p',
        title: 't',
        difficulty: 1,
        estimated_seconds: 20,
        tags: [],
        text_long: 'Long form line',
      },
    ]
    expect(
      publicLib.pickNextExercise({ mode: 'focus', userId: 'long-only', skill: null, prefs }).renderedText,
    ).toBe('Long form line')

    gates.override = () => [
      {
        id: 'short-wins',
        mode: 'focus',
        pack: 'p',
        title: 't',
        difficulty: 2,
        estimated_seconds: 20,
        tags: [],
        text_short: 'Short',
        text: 'From text',
        text_long: 'Long form line',
      },
    ]
    expect(
      publicLib.pickNextExercise({ mode: 'focus', userId: 'short-wins', skill: null, prefs }).renderedText,
    ).toBe('Short')

    gates.override = () => [
      {
        id: 'blank',
        mode: 'focus',
        pack: 'p',
        title: 't',
        difficulty: 1,
        estimated_seconds: 20,
        tags: [],
      },
    ]
    expect(publicLib.pickNextExercise({ mode: 'focus', userId: 'blank', skill: null, prefs }).renderedText).toBe('')

    gates.override = () => [
      {
        id: 'curly',
        mode: 'focus',
        pack: 'p',
        title: 't',
        difficulty: 1,
        estimated_seconds: 20,
        tags: [],
        text_short: 'It\u2019s fine.',
      },
    ]
    expect(publicLib.pickNextExercise({ mode: 'focus', userId: 'curly', skill: null, prefs }).renderedText).toBe(
      "It's fine.",
    )

    gates.override = () => [
      {
        id: 'tpl',
        mode: 'focus',
        pack: 'p',
        title: 'Template',
        difficulty: 3,
        estimated_seconds: 30,
        tags: ['calm', 'newlines'],
        type: 'template',
        template: 'Hello {name}',
        slots: { name: ['Ada'] },
      },
    ]
    const rendered = publicLib.pickNextExercise({
      mode: 'focus',
      userId: 'tpl-user',
      skill: skillShell({
        total_runs: 12,
        ema: { wpm: 80, accuracy: 1, backspace_rate: 0 },
        by_mode: {
          focus: { ema_wpm: 80, ema_accuracy: 1, ema_backspace_rate: 0, runs: 4 },
          real_life: { ema_wpm: 80, ema_accuracy: 1, ema_backspace_rate: 0, runs: 4 },
          competitive: { ema_wpm: 80, ema_accuracy: 1, ema_backspace_rate: 0, runs: 4 },
        },
        weak_tags: ['calm', 'multiline'],
        weakness_by_tag: { calm: 1.4, newlines: 0.2, sentences: 0 },
      }),
      prefs,
    })
    expect(rendered.renderedText).toBe('Hello Ada')
    expect(rendered.exercise.id).toBe('tpl')
    expect(rendered.seed).toContain('tpl')
  })

  it('throws when a mode is empty or has no screen-reader-safe line', () => {
    const prefs = sanitizePreferences(null)
    gates.override = () => []
    expect(() =>
      publicLib.pickNextExercise({ mode: 'focus', userId: 'empty-mode', skill: null, prefs }),
    ).toThrow('No exercises available for mode: focus')
    expect(publicLib.getPoolStatus('competitive')).toEqual({ total: 0, seen: 0, remaining: 0 })

    gates.override = () => [recExercise('custom-a'), recExercise('custom-b')]
    expect(publicLib.getPoolStatus('focus')).toEqual({ total: 2, seen: 0, remaining: 2 })

    gates.override = () => [recExercise('unsafe', { text: 'a\nb', text_short: 'a\nb' })]
    expect(() =>
      publicLib.pickNextExercise({
        mode: 'real_life',
        userId: 'sr-none',
        skill: null,
        prefs: sanitizePreferences({ screenReaderMode: true }),
      }),
    ).toThrow('No screen-reader-safe exercise for this mode')
  })

  it('relaxes novelty once every passage is seen and stays inside the safe set', () => {
    const prefs = sanitizePreferences(null)
    const unseen = publicLib.pickNextExercise({
      mode: 'focus',
      userId: 'unseen-sr',
      skill: null,
      prefs: sanitizePreferences({ screenReaderMode: true }),
    })
    expect(isScreenReaderSafePassage(unseen.exercise)).toBe(true)

    const focus = loadExercisesByMode('focus')
    const safe = focus.filter((exercise) => isScreenReaderSafePassage(exercise))
    expect(safe.length).toBeGreaterThan(0)
    const store = installMemoryStorage()
    store.set(
      'lkt_recents_v1',
      JSON.stringify({
        byMode: {
          focus: safe.map((exercise) => exercise.id),
          real_life: [],
          competitive: [],
        },
      }),
    )
    expect(publicLib.getPoolStatus('focus').seen).toBe(safe.length)
    const relaxed = publicLib.pickNextExercise({
      mode: 'focus',
      userId: 'seen-sr',
      skill: skillShell({ total_runs: 3 }),
      prefs: sanitizePreferences({ screenReaderMode: true }),
    })
    expect(isScreenReaderSafePassage(relaxed.exercise)).toBe(true)
    expect(relaxed.renderedText.length).toBeLessThan(1800)

    const realLifeId = loadExercisesByMode('real_life')[0].id
    store.set(
      'lkt_recents_v1',
      JSON.stringify({
        byMode: {
          focus: ['not-a-real-id', realLifeId, 'focus_calm_03_001', 'focus_calm_03_001', 'focus_calm_01_001'],
          real_life: [],
          competitive: [],
        },
      }),
    )
    const partial = publicLib.getPoolStatus('focus')
    expect(partial.seen).toBe(1)
    expect(partial.remaining).toBe(partial.total - 1)

    store.set(
      'lkt_recents_v1',
      JSON.stringify({
        byMode: {
          focus: [
            'not-a-real-id',
            realLifeId,
            'focus_calm_01_001',
            ...focus.map((exercise) => exercise.id),
          ],
          real_life: [],
          competitive: [],
        },
      }),
    )
    const full = publicLib.getPoolStatus('focus')
    expect(full.seen).toBe(full.total)
    expect(full.remaining).toBe(0)
    const next = publicLib.pickNextExercise({
      mode: 'focus',
      userId: 'all-seen',
      skill: skillShell({
        total_runs: 10,
        weak_tags: ['calm'],
        weakness_by_tag: { calm: 0.8 },
        by_mode: {
          focus: { ema_wpm: 28, ema_accuracy: 1, ema_backspace_rate: 0, runs: 6 },
          real_life: { ema_wpm: 44, ema_accuracy: 1, ema_backspace_rate: 0, runs: 6 },
          competitive: { ema_wpm: 76, ema_accuracy: 1, ema_backspace_rate: 0, runs: 6 },
        },
      }),
      prefs,
    })
    expect(focus.some((exercise) => exercise.id === next.exercise.id)).toBe(true)

    const bands = [20, 40, 50, 70, 80]
    for (const wpm of bands) {
      const picked = publicLib.pickNextExercise({
        mode: 'focus',
        userId: `band-${wpm}`,
        skill: skillShell({
          total_runs: 10,
          ema: { wpm, accuracy: 1, backspace_rate: 0 },
          by_mode: {
            focus: { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs: 2 },
            real_life: { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs: 2 },
            competitive: { ema_wpm: wpm, ema_accuracy: 1, ema_backspace_rate: 0, runs: 2 },
          },
        }),
        prefs,
      })
      expect(picked.renderedText.length).toBeGreaterThan(0)
    }

    expect(
      publicLib.pickNextExercise({
        mode: 'focus',
        userId: 'nan-runs',
        skill: skillShell({ total_runs: Number.NaN }),
        prefs,
      }).exercise.id,
    ).toBeTruthy()
    expect(
      publicLib.pickNextExercise({
        mode: 'focus',
        userId: 'few-runs',
        skill: skillShell({ total_runs: 1 }),
        prefs,
      }).exercise.id,
    ).toBeTruthy()
    expect(
      publicLib.pickNextExercise({
        mode: 'focus',
        userId: 'nan-wpm',
        skill: skillShell({
          total_runs: 10,
          ema: { wpm: Number.NaN, accuracy: 1, backspace_rate: 0 },
          by_mode: {} as UserSkillModel['by_mode'],
        }),
        prefs,
      }).exercise.id,
    ).toBeTruthy()
    expect(
      publicLib.pickNextExercise({
        mode: 'focus',
        userId: 'no-ema',
        skill: skillShell({
          total_runs: 10,
          ema: undefined as unknown as UserSkillModel['ema'],
          by_mode: {} as UserSkillModel['by_mode'],
        }),
        prefs,
      }).exercise.id,
    ).toBeTruthy()
  })
})
