import { describe, expect, it } from 'vitest'
import {
  STUDY_READER_MAX,
  STUDY_SOURCE_MAX,
  STUDY_TEXT_MAX,
  addStudySource,
  advanceStudyPlace,
  chunkStudyText,
  emptyStudyLibrary,
  ensureStudyDeck,
  openStudySource,
  projectStudy,
  removeStudySource,
  restartStudySource,
  setStudyOrder,
  shuffleStudyDeck,
  studyLibraryFromUnknown,
  studyNameFromFile,
  studySourceFromText,
  type StudyLibrary,
  type StudySource,
} from '../src/lib/studyLibrary'

function source(text: string, id = 's1', name = 'Notes'): StudySource {
  const made = studySourceFromText(name, text, id, 10)
  if ('error' in made) throw new Error(made.error)
  return made
}

function libraryWith(text: string, order: StudyLibrary['order'] = 'in_order'): StudyLibrary {
  const added = addStudySource(emptyStudyLibrary(), source(text))
  if ('error' in added) throw new Error(added.error)
  return order === 'in_order' ? added : setStudyOrder(added, order)
}

describe('chunkStudyText', () => {
  it('splits on blank lines and keeps a short paragraph whole', () => {
    expect(chunkStudyText('Alpha line\nstill alpha.\n\nBeta.', false)).toEqual(['Alpha line still alpha.', 'Beta.'])
    expect(chunkStudyText('', false)).toEqual([])
    expect(chunkStudyText('   \n\n  ', false)).toEqual([])
    expect(chunkStudyText('One.\r\n\r\nTwo.', false)).toEqual(['One.', 'Two.'])
    expect(chunkStudyText('One.\r\rTwo.', false)).toEqual(['One.', 'Two.'])
    expect(chunkStudyText('\uFEFFHello', false)).toEqual(['Hello'])
    // A short paragraph stays whole. Once it is long enough to cut, a period is a cut, including "Dr."
    const afterTitle = `${'Smith '.repeat(90).trim()}.`
    const titled = chunkStudyText(`Dr. ${afterTitle}`, false)
    expect(titled[0]).toBe('Dr.')
    expect(titled[1]?.startsWith('Smith')).toBe(true)
    expect(chunkStudyText('Dr. Smith went home. He sat.', false)).toEqual(['Dr. Smith went home. He sat.'])
  })

  it('packs sentences and then words when a paragraph is long', () => {
    const sentence = `${'word '.repeat(80).trim()}.`
    const chunks = chunkStudyText(`${sentence} ${sentence}`, false)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 480)).toBe(true)
    expect(chunks.join(' ')).toContain('word')
  })

  it('splits a single oversized word', () => {
    const chunks = chunkStudyText('x'.repeat(500), false)
    expect(chunks.every((chunk) => chunk.length <= 480)).toBe(true)
    expect(chunks.join('')).toBe('x'.repeat(500))
  })

  it('keeps a screen-reader piece on one line of at most 160 characters', () => {
    const text = `Alpha sits here.\n\n${'beta '.repeat(50).trim()}`
    const chunks = chunkStudyText(text, true)
    expect(chunks[0]).toBe('Alpha sits here.')
    expect(chunks.every((chunk) => chunk.length <= STUDY_READER_MAX && !chunk.includes('\n'))).toBe(true)
    expect(chunks.length).toBeGreaterThan(2)
  })
})

describe('study library', () => {
  it('names a file, rejects an empty or binary or oversized text, and caps the library', () => {
    expect(studyNameFromFile('C:\\notes\\Chapter 1.txt')).toBe('Chapter 1')
    expect(studyNameFromFile('poem.md')).toBe('poem')
    expect('error' in studySourceFromText(' ', '   ', 'id', 1)).toBe(true)
    expect(studySourceFromText('A', 'hello\0there', 'id', 1)).toEqual({ error: 'That file is not plain text.' })
    expect(studySourceFromText('A', 'x'.repeat(STUDY_TEXT_MAX + 1), 'id', 1)).toEqual({
      error: 'That text is too long to keep. Use a shorter file.',
    })
    const named = studySourceFromText('   ', 'Hello', 'id', 1)
    expect('name' in named && named.name).toBe('Untitled')

    let library = emptyStudyLibrary()
    for (let index = 0; index < STUDY_SOURCE_MAX; index += 1) {
      const next = addStudySource(library, source('Hi', `id-${index}`, `Note ${index}`))
      if ('error' in next) throw new Error(next.error)
      library = next
    }
    expect(addStudySource(library, source('More', 'overflow'))).toEqual({
      error: 'The library is full. Remove a text first.',
    })
    expect(addStudySource(library, source('More', 'id-0'))).toEqual({ error: 'That text was not kept.' })
  })

  it('remembers a shuffle until the piece boundaries change', () => {
    const rng = sequence(0)
    const shuffled = ensureStudyDeck(libraryWith('Alpha.\n\nBeta.\n\nGamma.', 'random'), false, rng)
    expect(shuffled.reshuffled).toBe(true)
    expect(shuffled.library.sources[0]?.permutation).toEqual(shuffleStudyDeck(3, sequence(0)))
    const again = ensureStudyDeck(shuffled.library, false, () => 0.9)
    expect(again.changed).toBe(false)
    expect(again.library).toBe(shuffled.library)

    const reader = ensureStudyDeck(shuffled.library, true, sequence(0))
    expect(reader.reshuffled).toBe(true)
    expect(reader.library.sources[0]?.place).toBe(0)
    expect(reader.library.sources[0]?.deckKey).not.toBe(shuffled.library.sources[0]?.deckKey)
  })

  it('keeps each text at its own place and restarts the active one', () => {
    const first = addStudySource(emptyStudyLibrary(), source('Alpha.\n\nBeta.', 'a', 'A'))
    if ('error' in first) throw new Error('add')
    const second = addStudySource(first, source('One.\n\nTwo.', 'b', 'B'))
    if ('error' in second) throw new Error('add')
    const moved = advanceStudyPlace(ensureStudyDeck(second, false, () => 0).library)
    expect(projectStudy(moved, false).chunk).toBe('Two.')
    const back = openStudySource(moved, 'a')
    expect(projectStudy(back, false).chunk).toBe('Alpha.')
    const ordered = setStudyOrder(back, 'random')
    expect(activePlace(ordered, 'a')).toBe(0)
    expect(activePlace(ordered, 'b')).toBe(1)
    const restarted = restartStudySource(setStudyOrder(ordered, 'in_order'), false, () => 0)
    expect(projectStudy(restarted, false).source?.id).toBe('a')
    expect(projectStudy(restarted, false).place).toBe(0)

    const removed = removeStudySource(moved, 'b')
    expect(removed.activeId).toBe('a')
    expect(removed.sources.map((item) => item.id)).toEqual(['a'])
  })

  it('drops a stored record that is not a text', () => {
    const library = studyLibraryFromUnknown({
      order: 'random',
      activeId: 'gone',
      sources: [
        { id: 'ok', name: ' Notes ', text: 'Hello', addedAt: 4, place: 2, permutation: [0], deckKey: 'k' },
        { id: 'bad', name: 'Bad', text: 'no\0', addedAt: 1, place: 0, permutation: null, deckKey: null },
        { id: 'ok', name: 'Duplicate', text: 'Other', addedAt: 1, place: 0, permutation: null, deckKey: null },
      ],
    })
    expect(library.order).toBe('random')
    expect(library.activeId).toBe('ok')
    expect(library.sources).toHaveLength(1)
    expect(library.sources[0]).toMatchObject({ name: 'Notes', place: 2, text: 'Hello' })
    expect(studyLibraryFromUnknown(null)).toEqual(emptyStudyLibrary())
  })

  it('repairs a damaged record and keeps each deck decision', () => {
    expect(studyNameFromFile('notes.text')).toBe('notes')
    expect(studyNameFromFile('notes.markdown')).toBe('notes')
    expect(studyNameFromFile('notes.TXT')).toBe('notes')
    expect(studyNameFromFile('')).toBe('')
    expect(studySourceFromText('A', 'Hi', '', 1)).toEqual({ error: 'That text was not kept.' })
    const named = studySourceFromText(`${'n'.repeat(90)}   extra`, 'Hi', 'id', Number.NaN)
    expect('name' in named && named.name).toHaveLength(80)
    expect('addedAt' in named && named.addedAt).toBe(0)

    const held = libraryWith('Hi')
    expect(addStudySource(held, source('More', 's1'))).toEqual({ error: 'That text was not kept.' })
    expect(openStudySource(held, 's1')).toBe(held)
    expect(openStudySource(held, 'missing')).toBe(held)
    expect(setStudyOrder(held, 'in_order')).toBe(held)
    const emptied = setStudyOrder(emptyStudyLibrary(), 'random')
    expect(emptied.order).toBe('random')
    expect(emptied.sources).toEqual([])

    const broken: StudyLibrary = {
      sources: [{ ...source('Alpha.\n\nBeta.'), place: Number.NaN }],
      order: 'in_order',
      activeId: 's1',
    }
    expect(advanceStudyPlace(broken).sources[0]?.place).toBe(1)
    const repaired = ensureStudyDeck(broken, false, () => 0)
    expect(repaired.changed).toBe(true)
    expect(repaired.reshuffled).toBe(false)
    expect(repaired.library.sources[0]?.place).toBe(0)

    const empty = emptyStudyLibrary()
    expect(ensureStudyDeck(empty, false, () => 0)).toEqual({ library: empty, changed: false, reshuffled: false })
    expect(projectStudy(empty, false).chunk).toBeNull()
    const orphan: StudyLibrary = { sources: [source('Hi')], order: 'in_order', activeId: 'nope' }
    expect(projectStudy(orphan, false).source).toBeNull()

    const ready = ensureStudyDeck(libraryWith('Alpha.\n\nBeta.'), false, () => 0).library
    const finished = advanceStudyPlace(advanceStudyPlace(ready))
    expect(projectStudy(finished, false)).toMatchObject({ finished: true, chunk: null, place: 2 })
    const stale: StudyLibrary = {
      ...ready,
      sources: [{ ...ready.sources[0]!, deckKey: 'stale', place: 1 }],
    }
    expect(projectStudy(stale, false)).toMatchObject({ needsRepair: true, place: 0, chunk: 'Alpha.' })

    const random = libraryWith('Alpha.\n\nBeta.\n\nGamma.', 'random')
    const badPerm: StudyLibrary = {
      ...random,
      sources: [{ ...random.sources[0]!, permutation: [0, 0, 1], deckKey: 'stale' }],
    }
    const reshuffle = ensureStudyDeck(badPerm, false, () => 0)
    expect(reshuffle.reshuffled).toBe(true)
    expect(reshuffle.library.sources[0]?.permutation).toEqual([1, 2, 0])
    expect(shuffleStudyDeck(0, () => 0)).toEqual([])
    expect(shuffleStudyDeck(1, () => 0.2)).toEqual([0])
    expect(shuffleStudyDeck(3, () => Number.NaN)).toEqual([1, 2, 0])
    expect(shuffleStudyDeck(3, () => 5)).toEqual([0, 1, 2])

    const pair = addStudySource(held, source('Other', 's2', 'Other'))
    if ('error' in pair) throw new Error(pair.error)
    const kept = removeStudySource({ ...pair, activeId: 's2' }, 's1')
    expect(kept.activeId).toBe('s2')
    expect(kept.sources.map((item) => item.id)).toEqual(['s2'])

    const huge = Array.from({ length: 100_001 }, () => 0)
    const damaged = studyLibraryFromUnknown({
      order: 'sideways',
      activeId: 4,
      sources: [
        { id: 'ok', name: '  Wide   name  ', text: 'Hi', addedAt: 'no', place: -1, permutation: [0, 1.5], deckKey: 'k'.repeat(201) },
        { id: 'x'.repeat(81), name: 'Long', text: 'Hi', place: 0 },
        { id: 'blank', name: '   ', text: 'Hi', place: 1.2 },
        null,
        ...Array.from({ length: STUDY_SOURCE_MAX }, (_, index) => ({
          id: `extra-${index}`,
          name: 'Extra',
          text: 'Hi',
          place: 0,
        })),
      ],
    })
    expect(damaged.order).toBe('in_order')
    expect(damaged.activeId).toBe('ok')
    expect(damaged.sources).toHaveLength(STUDY_SOURCE_MAX)
    expect(damaged.sources[0]).toMatchObject({ name: 'Wide name', addedAt: 0, place: 0, permutation: null, deckKey: null })
    expect(studyLibraryFromUnknown({ sources: 'nope' }).sources).toEqual([])
    expect(studyLibraryFromUnknown({ sources: [{ id: 'p', name: 'P', text: 'Hi', permutation: huge }] }).sources[0]?.permutation).toBeNull()
  })
})

function activePlace(library: StudyLibrary, id: string): number | undefined {
  return library.sources.find((item) => item.id === id)?.place
}

function sequence(value: number): () => number {
  return () => value
}
