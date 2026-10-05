import { afterEach, describe, expect, it } from 'vitest'
import { addStudySource, emptyStudyLibrary, studySourceFromText, type StudyLibrary } from '../src/lib/studyLibrary'
import { createIndexedDbStudyStore, createMemoryStudyStore } from '../src/lib/studyStore'

function sample(): StudyLibrary {
  const made = studySourceFromText('Notes', 'Alpha.\n\nBeta.', 's1', 5)
  if ('error' in made) throw new Error(made.error)
  const library = addStudySource(emptyStudyLibrary(), made)
  if ('error' in library) throw new Error(library.error)
  return library
}

describe('study store', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')

  afterEach(() => {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous)
    else delete (globalThis as { indexedDB?: unknown }).indexedDB
  })

  it('round-trips a library in memory', async () => {
    const store = createMemoryStudyStore()
    expect((await store.load()).ok).toBe(true)
    expect(await store.save(sample())).toBe(true)
    const loaded = await store.load()
    expect(loaded.ok && loaded.library.sources[0]?.name).toBe('Notes')
  })

  it('fails closed when indexedDB is missing', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true })
    const store = createIndexedDbStudyStore()
    expect(await store.load()).toEqual({ ok: false })
    expect(await store.save(sample())).toBe(false)
  })

  it('saves and reads the library through indexedDB', async () => {
    const store = createIndexedDbStudyStore(fakeFactory())
    expect(await store.save(sample())).toBe(true)
    const loaded = await store.load()
    expect(loaded.ok && loaded.library.sources[0]?.text).toBe('Alpha.\n\nBeta.')
    const again = createIndexedDbStudyStore(fakeFactory({ failOpen: true }))
    expect((await again.load()).ok).toBe(false)
    const refused = createIndexedDbStudyStore(fakeFactory({ failPut: true }))
    expect(await refused.save(sample())).toBe(false)
    const thrown = createIndexedDbStudyStore(fakeFactory({ throwOpen: true }))
    expect((await thrown.load()).ok).toBe(false)
    const fresh = createIndexedDbStudyStore(fakeFactory())
    const first = await fresh.load()
    expect(first.ok && first.library.sources).toEqual([])
    const odd = createIndexedDbStudyStore(fakeFactory({ throwValue: 'nope' }))
    expect((await odd.load()).ok).toBe(false)
    expect(await odd.save(sample())).toBe(false)
    const quiet = createIndexedDbStudyStore(fakeFactory({ failOpen: true, nullError: true }))
    expect((await quiet.load()).ok).toBe(false)
    const present = createIndexedDbStudyStore(fakeFactory({ prebuilt: true }))
    expect((await present.load()).ok).toBe(true)
    const missing = createIndexedDbStudyStore(fakeFactory({ skipUpgrade: true }))
    expect((await missing.load()).ok).toBe(false)
    expect(await missing.save(sample())).toBe(false)
  })
})

function fakeFactory(options?: {
  failOpen?: boolean
  failPut?: boolean
  throwOpen?: boolean
  throwValue?: unknown
  nullError?: boolean
  prebuilt?: boolean
  skipUpgrade?: boolean
}): IDBFactory {
  const databases = new Map<string, Map<string, Map<string, unknown>>>()
  if (options?.prebuilt) {
    const stores = new Map<string, Map<string, unknown>>()
    stores.set('library', new Map())
    databases.set('lokey-study', stores)
  }
  const factory = {
    open(name: string) {
      if (options?.throwValue !== undefined) throw options.throwValue
      if (options?.throwOpen) throw new Error('open threw')
      const request = {
        result: undefined as unknown,
        error: null as Error | null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      }
      queueMicrotask(() => {
        if (options?.failOpen) {
          request.error = options.nullError ? null : new Error('open failed')
          request.onerror?.()
          return
        }
        let stores = databases.get(name)
        const created = !stores
        if (!stores) {
          stores = new Map()
          databases.set(name, stores)
        }
        const db = {
          objectStoreNames: { contains: (storeName: string) => stores!.has(storeName) },
          createObjectStore(storeName: string) {
            stores!.set(storeName, new Map())
          },
          transaction(storeName: string) {
            const records = stores!.get(storeName)
            if (!records) throw new Error(`missing ${storeName}`)
            return {
              objectStore: () => ({
                get(key: string) {
                  const getRequest = {
                    result: records.get(key),
                    error: null as Error | null,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }
                  queueMicrotask(() => getRequest.onsuccess?.())
                  return getRequest
                },
                put(value: unknown, key: string) {
                  const putRequest = {
                    result: undefined as unknown,
                    error: options?.failPut ? new Error('put failed') : null,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }
                  queueMicrotask(() => {
                    if (options?.failPut) putRequest.onerror?.()
                    else {
                      records.set(key, structuredClone(value))
                      putRequest.onsuccess?.()
                    }
                  })
                  return putRequest
                },
              }),
            }
          },
          close() {},
        }
        request.result = db
        if (!options?.skipUpgrade && (created || options?.prebuilt)) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
  return factory as unknown as IDBFactory
}
