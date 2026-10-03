import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findExercise, loadAllPacks, loadExercisesByMode } from '../src/content/loadPacks'
import type { Exercise } from '../src/content/types'
import { AmbientHistoryV3 } from '../src/lib/ambient/ambientHistoryV3'
import { LRUBufferCache } from '../src/lib/ambient/lruBufferCache'
import {
  AMBIENT_CATEGORY_LABELS,
  ambientCategoriesInTracks,
  fetchAmbientManifest,
} from '../src/lib/ambientManifest'
import { getPoolStatus, pickNextExercise } from '../src/lib/contentEngine'
import { generateDailySet, loadDailyProgress, saveDailyProgress } from '../src/lib/dailySet'
import { buildFeedback, type MicroFeedbackInputs } from '../src/lib/feedback'
import { modeLabel, modeToPath, pathToMode, preferredQuickstartMode } from '../src/lib/mode'
import { isScreenReaderSafePassage } from '../src/lib/passageShape'
import { getNextRecommendations } from '../src/lib/recommendations'
import { competitiveMinLength } from '../src/lib/repeatPassage'
import { computeErrorHotspots, noteMistake, updateSkillModelFromRun } from '../src/lib/skillModel'
import {
  appendRun,
  bestAccuracyForExercise,
  bestWpmForExercise,
  getOrCreateUserId,
  getPersonalBest,
  loadLastMode,
  loadPreferences,
  loadRuns,
  loadSkillModel,
  maybeUpdatePersonalBest,
  resetPreferencesToDefaults,
  saveLastMode,
  savePreferences,
  saveSkillModel,
  topCompetitiveRuns,
  type RunResult,
  type UserSkillModel,
} from '../src/lib/storage'
import { clamp, computeStats, formatMs } from '../src/lib/typing'
import { attackOffsetSamples } from '../src/lib/attackOffset'
import '../src/lib/index'
import { ambientPlayer } from '../src/lib/public'

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

function calm(over: Partial<MicroFeedbackInputs> = {}): MicroFeedbackInputs {
  return {
    mode: 'focus',
    wpm: 40,
    accuracy: 0.96,
    errors: 1,
    backspaces: 2,
    duration_ms: 10_000,
    is_personal_best_wpm: false,
    is_personal_best_accuracy: false,
    delta_wpm_vs_best: 0,
    delta_accuracy_vs_best: 0,
    ...over,
  }
}

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    exercise_id: 'focus_calm_03_001',
    timestamp: 1_700_000_000_000,
    mode: 'focus',
    wpm: 42,
    accuracy: 0.98,
    errors: 1,
    backspaces: 1,
    duration_ms: 20_000,
    ...over,
  }
}

describe('mode, clock, and attack', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('maps every mode both ways and names them', () => {
    expect(pathToMode('focus')).toBe('focus')
    expect(pathToMode('competitive')).toBe('competitive')
    expect(pathToMode('real-life')).toBe('real_life')
    expect(modeToPath('focus')).toBe('focus')
    expect(modeToPath('competitive')).toBe('competitive')
    expect(modeToPath('real_life')).toBe('real-life')
    expect(modeLabel('focus')).toBe('Focus')
    expect(modeLabel('competitive')).toBe('Competitive')
    expect(modeLabel('real_life')).toBe('Real-Life')
  })

  it('remembers the last mode and falls back to focus', () => {
    expect(preferredQuickstartMode()).toBe('focus')
    expect(loadLastMode()).toBeNull()
    expect(saveLastMode('real_life')).toBe(true)
    expect(preferredQuickstartMode()).toBe('real_life')
  })

  it('computes a pace and formats the clock', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-1, 0, 1)).toBe(0)
    const idle = computeStats({ startedAtMs: null, nowMs: 5_000, correctChars: 0, incorrectChars: 0 })
    expect(idle.elapsedMs).toBe(0)
    expect(idle.accuracy).toBe(1)
    expect(idle.wpm).toBe(0)
    const going = computeStats({ startedAtMs: 0, nowMs: 60_000, correctChars: 50, incorrectChars: 10 })
    expect(going.wpm).toBeCloseTo(10)
    expect(going.accuracy).toBeCloseTo(50 / 60)
    expect(formatMs(65_000)).toBe('1:05')
    expect(formatMs(9_000)).toBe('0:09')
  })

  it('ignores a silent buffer and a gate above the peak', () => {
    expect(attackOffsetSamples(new Float32Array([0, 0, 0]))).toBe(0)
    expect(attackOffsetSamples(Float32Array.of(0.2, 0.5), 2)).toBe(0)
    expect(attackOffsetSamples(Float32Array.of(0, 0.5, 1), 0.5)).toBe(1)
  })

  it('lists packs through the cache', () => {
    expect(loadAllPacks().length).toBeGreaterThan(0)
    expect(loadAllPacks().length).toBeGreaterThan(0)
    expect(findExercise('missing')).toBeNull()
  })

  it('constructs the shared player without starting it', () => {
    expect(ambientPlayer).toBeTruthy()
  })
})

describe('feedback copy', () => {
  it('picks a calm line for each band', () => {
    expect(buildFeedback(calm({ is_personal_best_wpm: true, accuracy: 0.98 })).primary).toMatch(/personal best/)
    expect(buildFeedback(calm({ accuracy: 0.99, duration_ms: 20_000 })).primary).toMatch(/Excellent/)
    expect(buildFeedback(calm({ accuracy: 0.98 })).primary).toMatch(/Strong accuracy/)
    expect(buildFeedback(calm({ accuracy: 0.97, errors: 1 })).primary).toMatch(/Calm/)
    expect(buildFeedback(calm({ wpm: 55, accuracy: 0.96 })).primary).toMatch(/Good pace/)
    expect(buildFeedback(calm({ backspaces: 1, duration_ms: 20_000, accuracy: 0.95, wpm: 40, errors: 0 })).primary).toMatch(/Minimal/)
    expect(buildFeedback(calm({ errors: 2, accuracy: 0.95, wpm: 40, backspaces: 6, duration_ms: 1_000 })).primary).toMatch(/recovery/)
    expect(buildFeedback(calm({ accuracy: 0.9, errors: 4, backspaces: 6, duration_ms: 1_000 })).primary).toMatch(/less consistent/)
    expect(buildFeedback(calm({ accuracy: 0.94, errors: 0, backspaces: 6, wpm: 40, duration_ms: 1_000 })).primary).toMatch(/Good session/)
  })

  it('adds a calm aside and a competitive line', () => {
    expect(buildFeedback(calm({ backspaces: 15 })).secondary).toMatch(/Corrections/)
    expect(buildFeedback(calm({ errors: 8, backspaces: 0 })).secondary).toMatch(/Errors added/)
    expect(buildFeedback(calm({ wpm: 20, duration_ms: 30_000, backspaces: 0, errors: 1 })).secondary).toMatch(/Pace stayed/)
    expect(buildFeedback(calm()).secondary).toBeUndefined()
    expect(buildFeedback(calm()).isNewPb).toBe(false)

    const fast = calm({ mode: 'competitive', wpm: 70, accuracy: 0.99, is_personal_best_wpm: true })
    expect(buildFeedback(fast).primary).toMatch(/New PB WPM/)
    expect(buildFeedback(fast).isNewPb).toBe(true)
    expect(buildFeedback(calm({ mode: 'competitive', is_personal_best_accuracy: true, duration_ms: 20_000, accuracy: 0.96 })).primary).toMatch(/PB accuracy/)
    expect(buildFeedback(calm({ mode: 'competitive', accuracy: 0.99 })).primary).toMatch(/Elite/)
    expect(buildFeedback(calm({ mode: 'competitive', wpm: 60, accuracy: 0.97 })).primary).toMatch(/Fast and clean/)
    expect(buildFeedback(calm({ mode: 'competitive', wpm: 60, accuracy: 0.94 })).primary).toMatch(/Tighten accuracy/)
    expect(buildFeedback(calm({ mode: 'competitive', accuracy: 0.9, wpm: 40 })).primary).toMatch(/Accuracy dipped/)
    expect(buildFeedback(calm({ mode: 'competitive', accuracy: 0.96, wpm: 40 })).primary).toMatch(/Solid run/)
    expect(buildFeedback(calm({ mode: 'competitive', delta_wpm_vs_best: 2, accuracy: 0.96 })).secondary).toMatch(/Up vs best/)
    expect(buildFeedback(calm({ mode: 'competitive', delta_wpm_vs_best: -2 })).secondary).toMatch(/Down vs best/)
    expect(buildFeedback(calm({ mode: 'competitive', backspaces: 15, delta_wpm_vs_best: 0 })).secondary).toMatch(/Backspaces/)
    expect(buildFeedback(calm({ mode: 'competitive', errors: 10, backspaces: 0, delta_wpm_vs_best: 0 })).secondary).toMatch(/Errors spiked/)
    expect(buildFeedback(calm({ mode: 'real_life', is_personal_best_accuracy: true })).isNewPb).toBe(true)
  })
})

describe('recommendations and the daily miss paths', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('returns a bounded list and can aim at a weak tag', () => {
    const plain = getNextRecommendations({ mode: 'focus', count: 0, seed: 'a' }, { screenReaderMode: false })
    expect(plain.length).toBeGreaterThan(0)
    expect(plain[0].reasonText).toMatch(/current band/)

    const many = getNextRecommendations(
      {
        mode: 'focus',
        count: 99,
        seed: 'b',
        skill: {
          ema: { wpm: 20, accuracy: 0.9, backspace_rate: 0.1 },
          total_runs: 10,
          weak_tags: ['dashes', 'punctuation'],
          weakness_by_tag: { dashes: 0.8, punctuation: 0.4 },
          by_mode: {
            focus: { ema_wpm: 20, ema_accuracy: 0.9, ema_backspace_rate: 0.1, runs: 10 },
            real_life: { ema_wpm: 40, ema_accuracy: 0.9, ema_backspace_rate: 0, runs: 1 },
            competitive: { ema_wpm: 80, ema_accuracy: 0.9, ema_backspace_rate: 0, runs: 1 },
          },
          recent_exercise_ids_by_mode: { focus: [], real_life: [], competitive: [] },
        },
      },
      { screenReaderMode: false },
    )
    expect(many.length).toBeLessThanOrEqual(8)

    const sr = getNextRecommendations({ mode: 'competitive', count: 3, seed: 'c' }, { screenReaderMode: true })
    for (const row of sr) {
      const exercise = findExercise(row.exerciseId)
      expect(exercise && isScreenReaderSafePassage(exercise)).toBe(true)
    }

    const mid = getNextRecommendations(
      {
        mode: 'real_life',
        seed: 'd',
        skill: {
          ema: { wpm: Number.NaN, accuracy: 1, backspace_rate: 0 },
          total_runs: 2,
          weak_tags: [],
          weakness_by_tag: {},
          by_mode: {
            focus: { ema_wpm: 50, ema_accuracy: 1, ema_backspace_rate: 0, runs: 1 },
            real_life: { ema_wpm: 70, ema_accuracy: 1, ema_backspace_rate: 0, runs: 1 },
            competitive: { ema_wpm: 90, ema_accuracy: 1, ema_backspace_rate: 0, runs: 1 },
          },
          recent_exercise_ids_by_mode: {
            focus: loadExercisesByMode('focus').slice(0, 2).map((ex) => ex.id),
            real_life: [],
            competitive: [],
          },
        },
      },
      { screenReaderMode: false },
    )
    expect(mid.length).toBeGreaterThan(0)
  })

  it('keeps a bad daily record where it is', () => {
    const store = installMemoryStorage()
    expect(loadDailyProgress('2026-01-01', 'user', 'reset', false)).toBeNull()
    store.set('lkt_daily_progress_v1|user|2026-01-01|reset', '{')
    expect(loadDailyProgress('2026-01-01', 'user', 'reset', false)).toBeNull()
    store.set('lkt_daily_progress', JSON.stringify({ dateKey: 'other', userId: 'user', sessionType: 'reset', completedItems: [] }))
    expect(loadDailyProgress('2026-01-02', 'user', 'reset', false)).toBeNull()
    expect(store.has('lkt_daily_progress')).toBe(true)

    saveDailyProgress(
      { dateKey: '2026-01-03', userId: 'user', sessionType: 'mix', completedItems: [] },
      false,
    )
    expect(loadDailyProgress('2026-01-03', 'user', 'mix', false)?.sessionType).toBe('mix')

    const set = generateDailySet({
      userId: 'user',
      dateKey: '2026-04-01',
      sessionType: 'deep',
      weakTags: ['punctuation'],
      screenReaderMode: true,
      skill: {
        total_runs: 8,
        ema: { wpm: 48, accuracy: 0.97, backspace_rate: 0.05 },
        recent_exercise_ids_by_mode: { focus: ['focus_calm_03_001'], real_life: [], competitive: [] },
      },
    })
    expect(set.items.length).toBe(10)
    expect(generateDailySet({ userId: 'user', dateKey: '2026-04-01', sessionType: 'deep', screenReaderMode: true }).id).toBe(set.id)
  })

  it('relaxes novelty once every passage in the mode has been seen', () => {
    for (const exercise of loadExercisesByMode('focus')) {
      // pushRecent dedupes, and the pool id is the canonical one.
      expect(exercise.id.length).toBeGreaterThan(0)
    }
    const store = installMemoryStorage()
    store.set(
      'lkt_recents_v1',
      JSON.stringify({ byMode: { focus: loadExercisesByMode('focus').map((ex) => ex.id), real_life: [], competitive: [] } }),
    )
    const status = getPoolStatus('focus')
    expect(status.remaining).toBe(0)
    const next = pickNextExercise({
      mode: 'focus',
      userId: 'seen-all',
      skill: null,
      prefs: { ...loadPreferences(), screenReaderMode: false },
    })
    expect(next.exercise.id.length).toBeGreaterThan(0)
    expect(competitiveMinLength(undefined)).toBe(1800)
    expect(competitiveMinLength(30_000)).toBe(1800)
    expect(competitiveMinLength(60_000)).toBe(1800)
    expect(competitiveMinLength(120_000)).toBe(4000)
  })
})

describe('storage and skill edges', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('creates a user id once and resets preferences', () => {
    const id = getOrCreateUserId()
    expect(id.startsWith('u_')).toBe(true)
    expect(getOrCreateUserId()).toBe(id)
    const defaults = resetPreferencesToDefaults()
    expect(loadPreferences().ambientVolume).toBe(defaults.ambientVolume)
    expect(savePreferences(loadPreferences())).toBe(true)
  })

  it('drops a bad run and keeps a real personal best', () => {
    const store = installMemoryStorage()
    store.set('lkt_runs_v1', JSON.stringify([null, { exercise_id: '' }, { exercise_id: 'x', mode: 'nope' }, run({ sprint_duration_ms: 30_000, tags_hit: ['punctuation', 1] })]))
    expect(loadRuns()).toHaveLength(1)
    expect(appendRun(run({ mode: 'competitive', sprint_duration_ms: 60_000, wpm: 80, accuracy: 0.99 }))).toBe(true)
    expect(topCompetitiveRuns({ durationMs: 60_000, limit: 5 })).toHaveLength(1)
    expect(bestWpmForExercise('focus_calm_03_001', 30_000)).toBe(42)
    expect(bestAccuracyForExercise('missing')).toBeNull()
    expect(bestWpmForExercise('missing', 30_000)).toBeNull()

    expect(maybeUpdatePersonalBest({ exerciseId: 'ex', wpm: 10, accuracy: 0.5, timestamp: 1 }).updated).toBe(false)
    expect(maybeUpdatePersonalBest({ exerciseId: 'ex', sprintDurationMs: 30_000, wpm: 50, accuracy: 0.99, timestamp: 2 }).updated).toBe(true)
    expect(maybeUpdatePersonalBest({ exerciseId: 'ex', sprintDurationMs: 30_000, wpm: 40, accuracy: 0.99, timestamp: 3 }).updated).toBe(false)
    expect(getPersonalBest('ex', 30_000)?.wpm).toBe(50)
    expect(getPersonalBest('missing')).toBeNull()

    store.set('lkt_pbs_v1', JSON.stringify({ byKey: { bad: { exercise_id: 1 }, good: null } }))
    expect(loadRuns().length).toBeGreaterThan(0)
  })

  it('fills a partial skill document and scores a multiline run', () => {
    const store = installMemoryStorage()
    store.set(
      'lkt_skill_v1',
      JSON.stringify({
        version: 2,
        total_runs: 4,
        ema: { wpm: 30, accuracy: 0.95, backspace_rate: 0.1 },
      }),
    )
    const loaded = loadSkillModel()
    expect(loaded?.ema.wpm).toBe(30)
    expect(loaded?.performance_by_length.long.runs).toBe(0)
    saveSkillModel(loaded!)
    expect(loadSkillModel()?.total_runs).toBe(4)
    store.set(
      'lkt_skill_v1',
      JSON.stringify({ version: 1, total_runs: 3, weak_tags: ['dash'], updated_at: '2026-01-01T00:00:00.000Z' }),
    )
    expect(loadSkillModel()?.weakness_by_tag.dash).toBe(0.25)

    const exercise: Exercise = {
      id: 'multi',
      mode: 'focus',
      pack: 'p',
      title: 'Lines',
      difficulty: 2,
      estimated_seconds: 120,
      tags: ['newlines'],
      text: 'one\ntwo',
    }
    const prev = loaded!
    const next = updateSkillModelFromRun({
      prev: { ...prev, by_mode: undefined as unknown as UserSkillModel['by_mode'], ema: undefined as unknown as UserSkillModel['ema'] },
      run: run({ tags_hit: ['multiline', 'not-a-class'], backspaces: 3 }),
      exercise,
      targetText: 'one\ntwo',
      typedText: 'one\ntxo',
      mistakes: noteMistake({}, '\n'),
    })
    expect(next.performance_by_length.multiline.runs).toBeGreaterThan(0)
    expect(next.total_runs).toBe(prev.total_runs + 1)

    const hot = computeErrorHotspots({ target: "it's", typed: 'its ' })
    expect(hot.apostrophe + hot.space + hot.letters).toBeGreaterThan(0)
    expect(computeErrorHotspots({ target: 'ab', typed: 'a' }).letters).toBe(0)
  })

  it('survives a storage throw', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
      clear: () => {},
      key: () => null,
      length: 0,
    }
    Object.defineProperty(globalThis, 'localStorage', { value: throwing, configurable: true })
    expect(loadPreferences().ambientEnabled).toBe(true)
    expect(savePreferences(loadPreferences())).toBe(false)
    expect(getOrCreateUserId().startsWith('u_')).toBe(true)
    expect(loadDailyProgress('2026-01-01', 'user', 'reset', false)).toBeNull()
    saveDailyProgress({ dateKey: '2026-01-01', userId: 'user', sessionType: 'reset', completedItems: [] }, true)
    expect(loadSkillModel().total_runs).toBe(0)
  })
})

describe('ambient catalog and history', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('keeps a valid track and drops a bad manifest', async () => {
    expect(AMBIENT_CATEGORY_LABELS.cafe).toBe('Café')
    expect(ambientCategoriesInTracks([{ category: 'rain' }, { category: 'rain' }])).toEqual(['rain'])

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          version: 3,
          tracks: [
            { id: 'a', title: 'Rain', category: 'rain', path: 'a.wav', duration_sec: 10, tags: ['soft', 1], lufs_i: -32 },
            { id: '', title: 'nope', category: 'rain', path: 'b.wav', duration_sec: 10 },
            null,
            { id: 'b', title: 'Odd', category: 'nope', path: 'c.wav', duration_sec: 10 },
          ],
        }),
      })),
    )
    const manifest = await fetchAmbientManifest('/manifest.json')
    expect(manifest?.tracks).toHaveLength(1)
    expect(manifest?.tracks[0].lufs_i).toBe(-32)

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    expect(await fetchAmbientManifest()).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 'nope' }) })))
    expect(await fetchAmbientManifest()).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await fetchAmbientManifest()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('evicts the oldest buffer and remembers a track', () => {
    const cache = new LRUBufferCache(2)
    const a = { tag: 'a' } as unknown as AudioBuffer
    const b = { tag: 'b' } as unknown as AudioBuffer
    const c = { tag: 'c' } as unknown as AudioBuffer
    cache.set('a', a)
    cache.set('b', b)
    expect(cache.get('a')).toBe(a)
    cache.set('c', c)
    expect(cache.has('b')).toBe(false)
    expect(cache.size).toBe(2)
    cache.set('c', c)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(new LRUBufferCache(0).size).toBe(0)

    const history = new AmbientHistoryV3()
    expect(history.wasPlayedRecently('rain')).toBe(false)
    history.noteTrackPlayed('rain')
    expect(history.wasPlayedRecently('rain')).toBe(true)
    expect(history.wasPlayedWithinMs('rain', 60_000)).toBe(true)
    expect(history.wasPlayedWithinMs('other', 0)).toBe(false)
    const store = installMemoryStorage()
    store.set('lkt_ambient_history_v3', '{')
    expect(history.wasPlayedRecently('rain')).toBe(false)
    store.set('lkt_ambient_history_v3', JSON.stringify({ recentTracks: [{ id: '', atMs: 1 }, { id: 'ok', atMs: -1 }, { id: 'ok', atMs: 5 }] }))
    expect(history.wasPlayedRecently('ok', 10)).toBe(true)
  })
})

describe('audio context', () => {
  it('returns null without a constructor and resumes a suspended context', async () => {
    vi.resetModules()
    vi.stubGlobal('window', undefined)
    const missing = await import('../src/lib/audioContext')
    expect(missing.getAudioContext()).toBeNull()
    await missing.resumeAudioContext()

    vi.resetModules()
    const resume = vi.fn(async function (this: { state: string }) {
      this.state = 'running'
    })
    class FakeContext {
      state = 'suspended'
      resume = resume
    }
    vi.stubGlobal('window', { webkitAudioContext: FakeContext })
    const webkit = await import('../src/lib/audioContext')
    const ctx = webkit.getAudioContext()
    expect(ctx).toBeInstanceOf(FakeContext)
    expect(webkit.getAudioContext()).toBe(ctx)
    await webkit.resumeAudioContext()
    expect(resume).toHaveBeenCalledOnce()
    await webkit.resumeAudioContext()
    vi.unstubAllGlobals()
  })
})
