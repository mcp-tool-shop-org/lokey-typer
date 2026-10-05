import { emptyStudyLibrary, studyLibraryFromUnknown, type StudyLibrary } from './studyLibrary'

const DB_NAME = 'lokey-study'
const STORE_NAME = 'library'
const RECORD_KEY = 'library'

export type StudyLoad = { ok: true; library: StudyLibrary } | { ok: false }

export type StudyStore = {
  load: () => Promise<StudyLoad>
  save: (library: StudyLibrary) => Promise<boolean>
}

export function createMemoryStudyStore(initial?: StudyLibrary): StudyStore {
  let current = studyLibraryFromUnknown(initial ?? emptyStudyLibrary())
  return {
    async load() {
      return { ok: true, library: studyLibraryFromUnknown(current) }
    },
    async save(library) {
      current = studyLibraryFromUnknown(library)
      return true
    },
  }
}

export function createIndexedDbStudyStore(factory?: IDBFactory): StudyStore {
  const idb = factory ?? globalThis.indexedDB
  if (!idb) {
    return {
      async load() {
        return { ok: false }
      },
      async save() {
        return false
      },
    }
  }
  return {
    async load() {
      try {
        const raw = await readRecord(idb)
        return { ok: true, library: studyLibraryFromUnknown(raw) }
      } catch {
        return { ok: false }
      }
    },
    async save(library) {
      try {
        await writeRecord(idb, library)
        return true
      } catch {
        return false
      }
    },
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = factory.open(DB_NAME, 1)
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not open the study library.'))
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the study library.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The study library request failed.'))
  })
}

async function readRecord(factory: IDBFactory): Promise<unknown> {
  const db = await openDatabase(factory)
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    return await requestResult(tx.objectStore(STORE_NAME).get(RECORD_KEY))
  } finally {
    db.close()
  }
}

async function writeRecord(factory: IDBFactory, library: StudyLibrary): Promise<void> {
  const db = await openDatabase(factory)
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await requestResult(tx.objectStore(STORE_NAME).put(library, RECORD_KEY))
  } finally {
    db.close()
  }
}
