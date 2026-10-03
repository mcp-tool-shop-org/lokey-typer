import { beforeEach, describe, expect, it } from 'vitest'
import { loadExercisesByMode } from '../src/content/loadPacks'
import { getPoolStatus, pickNextExercise } from '../src/lib/contentEngine'
import { isScreenReaderSafePassage } from '../src/lib/passageShape'
import { pushRecent, sanitizePreferences } from '../src/lib/storage'

const USER_ID = 'pick-sr-fixed'

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

describe('pickNextExercise screen reader', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('returns a screen-reader-safe focus passage when screen reader mode is on', () => {
    const result = pickNextExercise({
      mode: 'focus',
      userId: USER_ID,
      skill: null,
      prefs: sanitizePreferences({ screenReaderMode: true }),
    })

    expect(isScreenReaderSafePassage(result.exercise)).toBe(true)
  })

  it('keeps a competitive passage under 1800 characters while screen reader mode is on', () => {
    const result = pickNextExercise({
      mode: 'competitive',
      userId: USER_ID,
      skill: null,
      prefs: sanitizePreferences({ screenReaderMode: true }),
    })

    expect(result.renderedText.length).toBeLessThan(1800)
  })

  it('pads a competitive passage to at least 1800 characters when screen reader mode is off', () => {
    const result = pickNextExercise({
      mode: 'competitive',
      userId: USER_ID,
      skill: null,
      prefs: sanitizePreferences({ screenReaderMode: false }),
    })

    expect(result.renderedText.length).toBeGreaterThanOrEqual(1800)
  })

  it('pads a 120 second competitive sprint to at least 4000 characters when screen reader mode is off', () => {
    const result = pickNextExercise({
      mode: 'competitive',
      userId: USER_ID,
      skill: null,
      prefs: sanitizePreferences({
        screenReaderMode: false,
        competitiveSprintDurationMs: 120000,
      }),
    })

    expect(result.renderedText.length).toBeGreaterThanOrEqual(4000)
  })
})

describe('focus recents count one passage', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installMemoryStorage()
  })

  it('counts an old id and the canonical id in the focus pool as one seen passage', () => {
    const poolIds = loadExercisesByMode('focus').map((exercise) => exercise.id)
    expect(poolIds).toContain('focus_calm_03_001')
    expect(poolIds).not.toContain('focus_calm_01_001')

    expect(pushRecent('focus', 'focus_calm_01_001')).toBe(true)
    expect(pushRecent('focus', 'focus_calm_03_001')).toBe(true)

    const saved = JSON.parse(store.get('lkt_recents_v1') ?? 'null') as { byMode: { focus: string[] } }
    expect(saved.byMode.focus).toContain('focus_calm_01_001')
    expect(saved.byMode.focus).toContain('focus_calm_03_001')
    expect(saved.byMode.focus).toHaveLength(2)

    const status = getPoolStatus('focus')
    expect(status.seen).toBe(1)
    expect(status.remaining).toBe(status.total - 1)
  })

  it('does not count an unknown id', () => {
    expect(pushRecent('focus', 'not-a-real-id')).toBe(true)
    expect(store.has('lkt_recents_v1')).toBe(true)

    const status = getPoolStatus('focus')
    expect(status.seen).toBe(0)
    expect(status.remaining).toBe(status.total)
  })

  it('does not return the canonical passage when only its old id is stored and other passages remain', () => {
    expect(pushRecent('focus', 'focus_calm_01_001')).toBe(true)
    const status = getPoolStatus('focus')
    expect(status.seen).toBe(1)
    expect(status.remaining).toBeGreaterThan(0)

    // The pick seed includes Date.now(), so each user id is a different draw.
    for (let i = 0; i < 300; i++) {
      const result = pickNextExercise({
        mode: 'focus',
        userId: `focus-alias-${i}`,
        skill: null,
        prefs: sanitizePreferences({ screenReaderMode: false }),
      })
      expect(result.exercise.id).not.toBe('focus_calm_03_001')
    }
  })
})
