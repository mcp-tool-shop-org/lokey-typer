export const STUDY_TEXT_MAX = 1_000_000
export const STUDY_SOURCE_MAX = 40
export const STUDY_NAME_MAX = 80
export const STUDY_PARAGRAPH_MAX = 480
export const STUDY_READER_MAX = 160

export type StudyOrder = 'in_order' | 'random'

export type StudySource = {
  id: string
  name: string
  text: string
  addedAt: number
  place: number
  permutation: number[] | null
  deckKey: string | null
}

export type StudyLibrary = {
  sources: StudySource[]
  order: StudyOrder
  activeId: string | null
}

export type StudyProjection = {
  source: StudySource | null
  chunks: string[]
  place: number
  count: number
  finished: boolean
  chunk: string | null
  needsRepair: boolean
}

export type StudyDeckRepair = {
  library: StudyLibrary
  changed: boolean
  reshuffled: boolean
}

export function emptyStudyLibrary(): StudyLibrary {
  return { sources: [], order: 'in_order', activeId: null }
}

export function chunkStudyText(text: string, screenReader: boolean): string[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []
  const limit = screenReader ? STUDY_READER_MAX : STUDY_PARAGRAPH_MAX
  const paragraphs = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  for (const paragraph of paragraphs) {
    const flat = paragraph.replace(/\s+/g, ' ').trim()
    if (!flat) continue
    if (flat.length <= limit) {
      chunks.push(flat)
      continue
    }
    packParts(chunks, splitSentences(flat), limit)
  }
  return chunks
}

export function studyNameFromFile(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? ''
  return base.replace(/\.(txt|text|md|markdown)$/i, '').trim()
}

export function studySourceFromText(
  name: string,
  text: string,
  id: string,
  addedAt: number,
): StudySource | { error: string } {
  if (!id) return { error: 'That text was not kept.' }
  const body = text.replace(/^\uFEFF/, '')
  if (body.includes('\0')) return { error: 'That file is not plain text.' }
  const trimmed = body.trim()
  if (!trimmed) return { error: 'Add some text first.' }
  if (trimmed.length > STUDY_TEXT_MAX) return { error: 'That text is too long to keep. Use a shorter file.' }
  const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, STUDY_NAME_MAX) || 'Untitled'
  return {
    id,
    name: cleanName,
    text: trimmed,
    addedAt: Number.isFinite(addedAt) ? addedAt : 0,
    place: 0,
    permutation: null,
    deckKey: null,
  }
}

export function addStudySource(library: StudyLibrary, source: StudySource): StudyLibrary | { error: string } {
  if (library.sources.some((item) => item.id === source.id)) return { error: 'That text was not kept.' }
  if (library.sources.length >= STUDY_SOURCE_MAX) return { error: 'The library is full. Remove a text first.' }
  return {
    ...library,
    sources: [...library.sources, source],
    activeId: source.id,
  }
}

export function removeStudySource(library: StudyLibrary, id: string): StudyLibrary {
  const sources = library.sources.filter((source) => source.id !== id)
  const activeId = library.activeId === id ? (sources[0]?.id ?? null) : library.activeId
  return { ...library, sources, activeId }
}

export function openStudySource(library: StudyLibrary, id: string): StudyLibrary {
  if (library.activeId === id) return library
  if (!library.sources.some((source) => source.id === id)) return library
  return { ...library, activeId: id }
}

export function setStudyOrder(library: StudyLibrary, order: StudyOrder): StudyLibrary {
  if (library.order === order) return library
  const next = { ...library, order }
  return mapActive(next, (source) => ({ ...source, place: 0 }))
}

export function advanceStudyPlace(library: StudyLibrary): StudyLibrary {
  return mapActive(library, (source) => ({
    ...source,
    place: Number.isInteger(source.place) && source.place >= 0 ? source.place + 1 : 1,
  }))
}

export function restartStudySource(library: StudyLibrary, screenReader: boolean, rng: () => number): StudyLibrary {
  return mapActive(library, (source) => {
    const chunks = chunkStudyText(source.text, screenReader)
    return {
      ...source,
      place: 0,
      permutation: library.order === 'random' ? shuffleStudyDeck(chunks.length, rng) : source.permutation,
      deckKey: studyDeckKey(source.id, source.text, screenReader, chunks.length),
    }
  })
}

export function ensureStudyDeck(library: StudyLibrary, screenReader: boolean, rng: () => number): StudyDeckRepair {
  const source = activeStudySource(library)
  if (!source) return { library, changed: false, reshuffled: false }
  const chunks = chunkStudyText(source.text, screenReader)
  const deckKey = studyDeckKey(source.id, source.text, screenReader, chunks.length)
  const keyOk = source.deckKey === deckKey
  const permOk = isPermutation(source.permutation, chunks.length)
  const placeOk = Number.isInteger(source.place) && source.place >= 0
  const needsShuffle = library.order === 'random' && !(keyOk && permOk)
  if (!needsShuffle && keyOk && placeOk) return { library, changed: false, reshuffled: false }
  const next = replaceSource(library, {
    ...source,
    deckKey,
    place: needsShuffle || !keyOk || !placeOk ? 0 : source.place,
    permutation: needsShuffle ? shuffleStudyDeck(chunks.length, rng) : source.permutation,
  })
  return { library: next, changed: true, reshuffled: needsShuffle }
}

export function projectStudy(library: StudyLibrary, screenReader: boolean): StudyProjection {
  const source = activeStudySource(library)
  if (!source) {
    return { source: null, chunks: [], place: 0, count: 0, finished: false, chunk: null, needsRepair: false }
  }
  const chunks = chunkStudyText(source.text, screenReader)
  const deckKey = studyDeckKey(source.id, source.text, screenReader, chunks.length)
  const keyOk = source.deckKey === deckKey
  const permOk = isPermutation(source.permutation, chunks.length)
  const placeOk = Number.isInteger(source.place) && source.place >= 0
  const randomReady = library.order !== 'random' || (keyOk && permOk)
  const needsRepair = !keyOk || !placeOk || !randomReady
  const place = needsRepair ? 0 : source.place
  const sequence =
    library.order === 'random' && keyOk && permOk && source.permutation
      ? source.permutation
      : chunks.map((_, index) => index)
  const finished = chunks.length > 0 && place >= sequence.length
  const chunkIndex = !finished && place >= 0 && place < sequence.length ? sequence[place] : -1
  const chunk = chunkIndex >= 0 ? (chunks[chunkIndex] ?? null) : null
  return { source, chunks, place, count: chunks.length, finished, chunk, needsRepair }
}

export function activeStudySource(library: StudyLibrary): StudySource | null {
  return library.sources.find((source) => source.id === library.activeId) ?? null
}

export function studyLibraryFromUnknown(value: unknown): StudyLibrary {
  if (!value || typeof value !== 'object') return emptyStudyLibrary()
  const raw = value as Record<string, unknown>
  const sources: StudySource[] = []
  const seen = new Set<string>()
  if (Array.isArray(raw.sources)) {
    for (const item of raw.sources) {
      const source = sourceFromUnknown(item)
      if (!source || seen.has(source.id)) continue
      seen.add(source.id)
      sources.push(source)
      if (sources.length >= STUDY_SOURCE_MAX) break
    }
  }
  const activeId = typeof raw.activeId === 'string' && seen.has(raw.activeId) ? raw.activeId : (sources[0]?.id ?? null)
  return {
    sources,
    order: raw.order === 'random' ? 'random' : 'in_order',
    activeId,
  }
}

export function shuffleStudyDeck(length: number, rng: () => number): number[] {
  const deck = Array.from({ length }, (_, index) => index)
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const roll = rng()
    const unclamped = Number.isFinite(roll) ? Math.floor(roll * (index + 1)) : 0
    const swap = Math.min(index, Math.max(0, unclamped))
    const current = deck[index] ?? index
    deck[index] = deck[swap] ?? swap
    deck[swap] = current
  }
  return deck
}

function studyDeckKey(id: string, text: string, screenReader: boolean, count: number): string {
  return `${id}|${screenReader ? 'sr' : 'page'}|${count}|${fnv1a32Hex(text)}`
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function packParts(chunks: string[], parts: string[], limit: number) {
  let current = ''
  const flush = () => {
    if (!current) return
    chunks.push(current)
    current = ''
  }
  for (const part of parts) {
    if (part.length > limit) {
      flush()
      chunks.push(...windowWords(part, limit))
      continue
    }
    const next = current ? `${current} ${part}` : part
    if (next.length <= limit) current = next
    else {
      flush()
      current = part
    }
  }
  flush()
}

function windowWords(text: string, limit: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  const flush = () => {
    if (!current) return
    chunks.push(current)
    current = ''
  }
  for (const word of words) {
    if (word.length > limit) {
      flush()
      for (let index = 0; index < word.length; index += limit) chunks.push(word.slice(index, index + limit))
      continue
    }
    const next = current ? `${current} ${word}` : word
    if (next.length <= limit) current = next
    else {
      flush()
      current = word
    }
  }
  flush()
  return chunks
}

function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function isPermutation(values: number[] | null, length: number): boolean {
  if (!values || values.length !== length) return false
  const seen = new Set<number>()
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value >= length || seen.has(value)) return false
    seen.add(value)
  }
  return seen.size === length
}

function activeStudySourceId(library: StudyLibrary): string | null {
  return library.activeId
}

function mapActive(library: StudyLibrary, update: (source: StudySource) => StudySource): StudyLibrary {
  const id = activeStudySourceId(library)
  if (!id) return library
  let changed = false
  const sources = library.sources.map((source) => {
    if (source.id !== id) return source
    const next = update(source)
    if (next !== source) changed = true
    return next
  })
  return changed ? { ...library, sources } : library
}

function replaceSource(library: StudyLibrary, source: StudySource): StudyLibrary {
  return {
    ...library,
    sources: library.sources.map((item) => (item.id === source.id ? source : item)),
  }
}

function sourceFromUnknown(value: unknown): StudySource | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 80) return null
  if (typeof raw.text !== 'string' || !raw.text.trim() || raw.text.length > STUDY_TEXT_MAX || raw.text.includes('\0')) {
    return null
  }
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null
  const permutation = permutationFromUnknown(raw.permutation)
  return {
    id: raw.id,
    name: raw.name.trim().replace(/\s+/g, ' ').slice(0, STUDY_NAME_MAX),
    text: raw.text,
    addedAt: typeof raw.addedAt === 'number' && Number.isFinite(raw.addedAt) ? raw.addedAt : 0,
    place: typeof raw.place === 'number' && Number.isInteger(raw.place) && raw.place >= 0 ? raw.place : 0,
    permutation,
    deckKey: typeof raw.deckKey === 'string' && raw.deckKey.length <= 200 ? raw.deckKey : null,
  }
}

function permutationFromUnknown(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > 100_000) return null
  const numbers: number[] = []
  for (const item of value) {
    if (!Number.isInteger(item) || item < 0) return null
    numbers.push(item)
  }
  return numbers
}
