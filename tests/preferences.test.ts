import { beforeEach, describe, expect, it } from 'vitest'
import { loadPreferences, savePreferences, sanitizePreferences } from '../src/lib/storage'

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
