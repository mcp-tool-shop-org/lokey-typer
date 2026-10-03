import { beforeEach, describe, expect, it } from 'vitest'
import { findExercise } from '../src/content/loadPacks'
import { generateDailySet, loadDailyProgress, saveDailyProgress } from '../src/lib/dailySet'
import { isScreenReaderSafePassage } from '../src/lib/passageShape'

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

describe('generateDailySet screen reader', () => {
  it('keeps every item short and single-line', () => {
    const set = generateDailySet({
      userId: 'daily-sr-test',
      dateKey: '2026-10-03',
      sessionType: 'mix',
      screenReaderMode: true,
    })

    expect(set.items.length).toBeGreaterThan(0)
    for (const item of set.items) {
      const exercise = findExercise(item.exerciseId)
      expect(exercise).not.toBeNull()
      expect(isScreenReaderSafePassage(exercise!)).toBe(true)
    }
  })

  it('repeats the same items for the same day', () => {
    const args = {
      userId: 'daily-sr-stable',
      dateKey: '2026-10-03',
      sessionType: 'reset' as const,
      screenReaderMode: true,
    }
    const a = generateDailySet(args)
    const b = generateDailySet(args)
    expect(a.items.map((item) => item.exerciseId)).toEqual(b.items.map((item) => item.exerciseId))
  })
})

describe('daily progress', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('keeps reset progress when mix progress is saved', () => {
    const dateKey = '2026-10-03'
    const userId = 'daily-progress-split'
    const resetProgress = {
      dateKey,
      userId,
      sessionType: 'reset' as const,
      completedItems: [{ wpm: 42, accuracy: 1, durationMs: 1000, completedAt: 10 }],
      startedAt: 1,
    }
    const mixProgress = {
      dateKey,
      userId,
      sessionType: 'mix' as const,
      completedItems: [{ wpm: 55, accuracy: 0.99, durationMs: 2000, completedAt: 20 }],
      startedAt: 2,
    }

    saveDailyProgress(resetProgress, false)
    saveDailyProgress(mixProgress, false)

    expect(loadDailyProgress(dateKey, userId, 'reset', false)?.completedItems).toEqual(
      resetProgress.completedItems,
    )
    expect(loadDailyProgress(dateKey, userId, 'mix', false)?.completedItems).toEqual(
      mixProgress.completedItems,
    )
    expect(loadDailyProgress(dateKey, userId, 'reset', true)).toBeNull()
  })

  it('moves a matching legacy blob onto the versioned key', () => {
    const legacy = {
      dateKey: '2026-10-03',
      userId: 'daily-legacy',
      sessionType: 'reset' as const,
      completedItems: [{ wpm: 40, accuracy: 0.98, durationMs: 1000, completedAt: 1 }],
      startedAt: 1,
    }
    store.set('lkt_daily_progress', JSON.stringify(legacy))

    expect(loadDailyProgress(legacy.dateKey, legacy.userId, legacy.sessionType, false)).toEqual(legacy)
    expect(store.has('lkt_daily_progress')).toBe(false)

    const versionedKey = `lkt_daily_progress_v1|${legacy.userId}|${legacy.dateKey}|${legacy.sessionType}`
    expect(JSON.parse(store.get(versionedKey) ?? 'null')).toEqual(legacy)
  })
})

describe('generateDailySet date key', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('uses the local calendar day when dateKey is omitted', () => {
    const now = new Date()
    const localKey = [
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    const set = generateDailySet({
      userId: 'daily-local-calendar',
      sessionType: 'mix',
    })

    expect(set.dateKey).toBe(localKey)
  })
})
