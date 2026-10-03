import { beforeEach, describe, expect, it } from 'vitest'
import { enforceAccessibilityLocks, getEffectiveAmbientEnabled } from '../src/lib/effectivePrefs'
import {
  appendRun,
  getPersonalBest,
  loadPreferences,
  loadRuns,
  loadSkillModel,
  maybeUpdatePersonalBest,
  saveLastMode,
  savePreferences,
  sanitizePreferences,
} from '../src/lib/storage'

const KEY = 'lkt_prefs_v1'
const LKG = 'lkt_prefs_v1_lkg'

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

describe('preference backup', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('does not replace the last good snapshot when the live value is corrupt', () => {
    savePreferences(sanitizePreferences({ volume: 0.25, ambientVolume: 0.4 }))
    store.set(KEY, '{')

    const loaded = loadPreferences()

    expect(loaded.volume).toBe(0.25)
    expect(JSON.parse(store.get(LKG) ?? '{}').volume).toBe(0.25)
  })

  it('corrects an out-of-range live value without overwriting the backup', () => {
    savePreferences(sanitizePreferences({ volume: 0.25 }))
    const broken = JSON.parse(store.get(KEY) ?? '{}') as { volume: number }
    broken.volume = 4
    store.set(KEY, JSON.stringify(broken))

    const loaded = loadPreferences()

    expect(loaded.volume).toBe(1)
    expect(JSON.parse(store.get(LKG) ?? '{}').volume).toBe(0.25)
    expect(JSON.parse(store.get(KEY) ?? '{}').volume).toBe(1)
  })
})

describe('accessibility locks', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('forces ambient off in screen reader mode and leaves it on for reduced motion', () => {
    const screenReaderOn = {
      ambientEnabled: true,
      screenReaderMode: true,
      reducedMotion: false,
    }
    expect(enforceAccessibilityLocks(screenReaderOn).ambientEnabled).toBe(false)
    expect(getEffectiveAmbientEnabled(screenReaderOn)).toBe(false)

    const reducedMotionOnly = {
      ambientEnabled: true,
      screenReaderMode: false,
      reducedMotion: true,
    }
    expect(enforceAccessibilityLocks(reducedMotionOnly).ambientEnabled).toBe(true)
    expect(getEffectiveAmbientEnabled(reducedMotionOnly)).toBe(true)

    savePreferences(sanitizePreferences({ screenReaderMode: true, ambientEnabled: true }))
    const loaded = loadPreferences()
    expect(loaded.screenReaderMode).toBe(true)
    expect(loaded.ambientEnabled).toBe(false)

    const live = JSON.parse(store.get(KEY) ?? '{}') as { ambientEnabled: boolean; screenReaderMode: boolean }
    live.ambientEnabled = true
    live.screenReaderMode = true
    store.set(KEY, JSON.stringify(live))

    const corrected = loadPreferences()
    expect(corrected.screenReaderMode).toBe(true)
    expect(corrected.ambientEnabled).toBe(false)
    expect(JSON.parse(store.get(LKG) ?? '{}').ambientEnabled).toBe(false)
    expect(JSON.parse(store.get(LKG) ?? '{}').screenReaderMode).toBe(true)
  })
})

describe('personal bests and run history', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('stores a 95 percent best per sprint length and ignores accuracy of 0.94', () => {
    const rejected = maybeUpdatePersonalBest({
      exerciseId: 'ex-sprint',
      sprintDurationMs: 30_000,
      wpm: 120,
      accuracy: 0.94,
      timestamp: 1_700_000_000_000,
    })
    expect(rejected.updated).toBe(false)
    expect(getPersonalBest('ex-sprint', 30_000)).toBeNull()

    maybeUpdatePersonalBest({
      exerciseId: 'ex-sprint',
      sprintDurationMs: 30_000,
      wpm: 55,
      accuracy: 0.95,
      timestamp: 1_700_000_000_100,
    })
    maybeUpdatePersonalBest({
      exerciseId: 'ex-sprint',
      sprintDurationMs: 60_000,
      wpm: 80,
      accuracy: 0.99,
      timestamp: 1_700_000_000_200,
    })

    expect(getPersonalBest('ex-sprint', 30_000)).toMatchObject({ wpm: 55, accuracy: 0.95 })
    expect(getPersonalBest('ex-sprint', 60_000)).toMatchObject({ wpm: 80, accuracy: 0.99 })
    expect(getPersonalBest('ex-sprint', 120_000)).toBeNull()
  })

  it('skips a broken runs value and rows that are not a valid focus run', () => {
    store.set('lkt_runs_v1', '{')
    expect(() => loadRuns()).not.toThrow()
    expect(loadRuns()).toEqual([])

    const valid = {
      exercise_id: 'ex-focus',
      mode: 'focus' as const,
      timestamp: 1_700_000_000_000,
      wpm: 48,
      accuracy: 0.98,
      errors: 2,
      backspaces: 3,
      duration_ms: 20_000,
    }
    store.set('lkt_runs_v1', JSON.stringify([valid, { junk: true }, 'not-a-row']))
    let rows: ReturnType<typeof loadRuns> = []
    expect(() => {
      rows = loadRuns()
    }).not.toThrow()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject(valid)
  })
})

describe('storage writes and skill documents', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('does not throw when setItem fails and getItem still works', () => {
    const storage = globalThis.localStorage
    storage.setItem = () => {
      throw new Error('quota')
    }
    expect(storage.getItem('lkt_runs_v1')).toBeNull()

    const valid = {
      exercise_id: 'ex-focus',
      mode: 'focus' as const,
      timestamp: 1_700_000_000_000,
      wpm: 48,
      accuracy: 0.98,
      errors: 2,
      backspaces: 3,
      duration_ms: 20_000,
    }

    expect(() => appendRun(valid)).not.toThrow()
    expect(() => saveLastMode('focus')).not.toThrow()
    expect(() =>
      maybeUpdatePersonalBest({
        exerciseId: 'ex-focus',
        wpm: 48,
        accuracy: 0.99,
        timestamp: 1_700_000_000_000,
      }),
    ).not.toThrow()
    expect(storage.getItem('lkt_runs_v1')).toBeNull()
    expect(storage.getItem('lkt_last_mode_v1')).toBeNull()
  })

  it('fills a bare version 2 skill model and keeps a complete short bucket', () => {
    const present = {
      ema_wpm: 0,
      ema_accuracy: 1,
      ema_backspace_rate: 0,
      runs: 0,
    }

    store.set('lkt_skill_v1', JSON.stringify({ version: 2 }))
    const filled = loadSkillModel()
    expect(filled.performance_by_length.short).toEqual({
      ema_wpm: 0,
      ema_accuracy: 1,
      ema_backspace_rate: 0,
      runs: 0,
    })
    expect(filled.performance_by_length.medium.runs).toBe(0)
    expect(filled.performance_by_length.long.runs).toBe(0)
    expect(filled.performance_by_length.multiline.runs).toBe(0)

    store.set(
      'lkt_skill_v1',
      JSON.stringify({
        version: 2,
        total_runs: 4,
        performance_by_length: {
          short: { ...present, ema_wpm: 42 },
          medium: present,
          long: present,
          multiline: present,
        },
      }),
    )
    const kept = loadSkillModel()
    expect(kept.total_runs).toBe(4)
    expect(kept.performance_by_length.short.ema_wpm).toBe(42)
  })
})
