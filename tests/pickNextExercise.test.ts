import { beforeEach, describe, expect, it } from 'vitest'
import { pickNextExercise } from '../src/lib/contentEngine'
import { isScreenReaderSafePassage } from '../src/lib/passageShape'
import { sanitizePreferences } from '../src/lib/storage'

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
})
