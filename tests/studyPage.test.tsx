// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider, usePreferences } from '@app'
import { savePreferences, loadPreferences } from '../src/lib/storage'
import { graphemesOf } from '../src/lib/typingEdit'
import { typewriterAudio } from '@lib'
import { StudyPage } from '@features/study'
import { createMemoryStudyStore, type StudyStore } from '@lib'
import {
  STUDY_SOURCE_MAX,
  STUDY_TEXT_MAX,
  addStudySource,
  emptyStudyLibrary,
  studySourceFromText,
  type StudyLibrary,
} from '../src/lib/studyLibrary'

function renderStudy(store?: StudyStore, rng?: () => number) {
  return render(
    <PreferencesProvider>
      <StudyPage store={store ?? createMemoryStudyStore()} rng={rng} createId={sequence(['a', 'b', 'c'])} />
    </PreferencesProvider>,
  )
}

function sequence(ids: string[]): () => string {
  let index = 0
  return () => ids[index++] ?? `id-${index}`
}

function setupUser() {
  return userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never })
}

function ReaderSwitch() {
  const { prefs, patchPrefs } = usePreferences()
  return (
    <button type="button" onClick={() => patchPrefs({ screenReaderMode: !prefs.screenReaderMode })}>
      Toggle reader
    </button>
  )
}

function scriptedStore(results: boolean[], initial?: StudyLibrary): StudyStore {
  let library = initial ?? emptyStudyLibrary()
  let index = 0
  return {
    async load() {
      return { ok: true, library }
    },
    async save(next) {
      const ok = results[index] ?? false
      index += 1
      if (ok) library = next
      return ok
    },
  }
}

function setPaste(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Paste text' }), { target: { value } })
}

function typeAll(text: string) {
  const input = screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement
  let value = input.value
  for (const grapheme of graphemesOf(text)) {
    value += grapheme
    fireEvent.keyDown(input, { key: grapheme })
    fireEvent.input(input, { target: { value }, isComposing: false })
  }
}

describe('Study page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(typewriterAudio, 'play').mockImplementation(() => {})
    vi.spyOn(typewriterAudio, 'ensureReady').mockResolvedValue(undefined)
    vi.spyOn(typewriterAudio, 'resume').mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('explains an empty library and keeps a pasted text after a remount', async () => {
    const user = setupUser()
    const store = createMemoryStudyStore()
    const first = renderStudy(store)
    expect(await screen.findByRole('heading', { name: 'Study' })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Study — LoKey Typer'))
    expect(screen.getByText(/comes back one piece at a time/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Add text' }))
    expect(screen.getByRole('status').textContent).toBe('Add some text first.')

    setPaste('Alpha.\n\nBeta.')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Notes')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    expect(await screen.findByRole('button', { name: 'Notes' })).toBeTruthy()
    expect(screen.getByText('Piece 1 of 2')).toBeTruthy()

    first.unmount()
    renderStudy(store)
    expect(await screen.findByRole('button', { name: 'Notes' })).toBeTruthy()
    expect(screen.getByText('Piece 1 of 2')).toBeTruthy()
  })

  it('feeds the next piece after a finish and still has it after a restart', async () => {
    const user = setupUser()
    const store = createMemoryStudyStore()
    const view = renderStudy(store)
    expect(await screen.findByRole('heading', { name: 'Study' })).toBeTruthy()
    setPaste('Alpha\n\nBeta')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('heading', { name: 'Untitled' })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Untitled — LoKey Typer'))
    await waitFor(() => expect(passage()).toBe('Alpha'))

    typeAll('Alpha')
    await screen.findByText(/WPM:/)
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByText('Piece 2 of 2')).toBeTruthy()

    view.unmount()
    renderStudy(store)
    expect(await screen.findByText('Piece 2 of 2')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Untitled' })).toBeTruthy()
    await waitFor(() => expect(passage()).toBe('Beta'))
  })

  it('shuffles once and starts that same deck from the beginning when the order changes', async () => {
    const user = setupUser()
    renderStudy(createMemoryStudyStore(), () => 0)
    expect(await screen.findByRole('heading', { name: 'Study' })).toBeTruthy()
    setPaste('Alpha\n\nBeta\n\nGamma')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Shuffled' }))
    expect(screen.getByRole('button', { name: 'Shuffled' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Changing the order starts this text from the beginning.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    // The run screen renders after the click settles; a loaded CI runner can be a beat behind.
    await waitFor(() => expect(passage()).toBe('Beta'))
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    await user.click(screen.getByRole('button', { name: 'In order' }))
    expect(screen.getByText('Piece 1 of 3')).toBeTruthy()
  })

  it('removes a text and refuses a file that is not text', async () => {
    const user = setupUser()
    renderStudy(createMemoryStudyStore())
    expect(await screen.findByLabelText('Add a text file')).toBeTruthy()
    const file = new File(['Kept line'], 'chapter.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('Add a text file'), file)
    expect(await screen.findByRole('button', { name: 'chapter' })).toBeTruthy()
    await user.upload(screen.getByLabelText('Add a text file'), new File(['bad\0byte'], 'bad.txt', { type: 'text/plain' }))
    expect(screen.getByRole('status').textContent).toBe('That file is not plain text.')
    await user.click(screen.getByRole('button', { name: 'Remove chapter' }))
    expect(screen.queryByRole('button', { name: 'chapter' })).toBeNull()
  })

  it('says when the library cannot be opened or a text cannot be kept', async () => {
    const user = setupUser()
    renderStudy({
      load: async () => ({ ok: false }),
      save: async () => false,
    })
    expect(await screen.findByText('This library could not be opened.')).toBeTruthy()

    cleanup()
    renderStudy({
      load: async () => ({ ok: true, library: { sources: [], order: 'in_order', activeId: null } }),
      save: async () => false,
    })
    await user.type(await screen.findByRole('textbox', { name: 'Paste text' }), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'That text was not kept.')
    expect(screen.queryByRole('button', { name: 'Remove Untitled' })).toBeNull()
  })

  it('uses a short line when screen reader mode is on', async () => {
    savePreferences({ ...loadPreferences(), screenReaderMode: true })
    const user = setupUser()
    const words = Array.from({ length: 40 }, () => 'word').join(' ')
    renderStudy(createMemoryStudyStore())
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste(words)
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const text = await waitFor(() => passage())
    expect(text.length).toBeLessThanOrEqual(160)
    expect(text.startsWith('word')).toBe(true)
    expect(text.length).toBeLessThan(words.length)
  })

  it('starts a finished text over', async () => {
    const user = setupUser()
    renderStudy(createMemoryStudyStore())
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Done')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    typeAll('Done')
    await screen.findByText(/WPM:/)
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByText("You've finished Untitled.")).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Start again' }))
    expect(screen.getByText('Piece 1 of 1')).toBeTruthy()
  })

  it('refuses a text that is too long to keep', async () => {
    const user = setupUser()
    renderStudy(createMemoryStudyStore())
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('x'.repeat(STUDY_TEXT_MAX + 1))
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    expect(screen.getByRole('status').textContent).toBe('That text is too long to keep. Use a shorter file.')
  })

  it('keeps each text at its own place', async () => {
    const user = setupUser()
    renderStudy(createMemoryStudyStore())
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Alpha\n\nBeta')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'First')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    typeAll('Alpha')
    await screen.findByText(/WPM:/)
    await user.click(screen.getByRole('button', { name: 'Exit' }))

    setPaste('One\n\nTwo')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Second')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    await waitFor(() => expect(passage()).toBe('One'))
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    await user.click(screen.getByRole('button', { name: 'First' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(passage()).toBe('Beta'))
  })

  it('stays on the same piece when the session restarts', async () => {
    const user = setupUser()
    renderStudy(createMemoryStudyStore())
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Alpha\n\nBeta')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    await waitFor(() => expect(passage()).toBe('Alpha'))
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    await waitFor(() => expect(passage()).toBe('Alpha'))
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByText('Piece 1 of 2')).toBeTruthy()
  })

  it('leaves the piece when screen reader mode changes', async () => {
    const user = setupUser()
    render(
      <PreferencesProvider>
        <ReaderSwitch />
        <StudyPage store={createMemoryStudyStore()} createId={() => 'a'} />
      </PreferencesProvider>,
    )
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Alpha\n\nBeta')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    await waitFor(() => expect(passage()).toBe('Alpha'))
    await user.click(screen.getByRole('button', { name: 'Toggle reader' }))
    expect(screen.queryByRole('textbox', { name: 'Typing input' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Study' })).toBeTruthy()
  })

  it('says when a file cannot be read and ignores an empty selection', async () => {
    renderStudy(createMemoryStudyStore())
    const input = await screen.findByLabelText('Add a text file')
    fireEvent.change(input, { target: { files: [] } })
    expect(screen.queryByRole('status')).toBeNull()
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    vi.spyOn(file, 'text').mockRejectedValue(new Error('unreadable'))
    fireEvent.change(input, { target: { files: [file] } })
    expect((await screen.findByRole('status')).textContent).toBe('That file could not be read.')
  })

  it('does not start a new shuffle when that order cannot be saved', async () => {
    const user = setupUser()
    renderStudy(scriptedStore([true, true, false]), () => 0)
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Alpha\n\nBeta\n\nGamma')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Shuffled' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'This order could not be saved, so the piece was not started.',
    )
    expect(screen.queryByRole('textbox', { name: 'Typing input' })).toBeNull()
  })

  it('starts the piece anyway when an in-order repair cannot be saved', async () => {
    const user = setupUser()
    renderStudy(scriptedStore([true, false]))
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Hello there')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'This library could not be saved. It stays until you leave this page.',
    )
    await waitFor(() => expect(passage()).toBe('Hello there'))
  })

  it('keeps the previous order, text, and place when a save does not land', async () => {
    const user = setupUser()
    const view = renderStudy(scriptedStore([true, false]))
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Alpha\n\nBeta')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Shuffled' }))
    expect((await screen.findByRole('status')).textContent).toBe('That change was not kept.')
    expect(screen.getByRole('button', { name: 'In order' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'In order' }))
    await user.click(screen.getByRole('button', { name: 'Remove Untitled' }))
    expect(screen.getByRole('button', { name: 'Remove Untitled' })).toBeTruthy()

    view.unmount()
    renderStudy(scriptedStore([true, true, false]))
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('One')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'First')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    setPaste('Two')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Second')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Second' }))
    await user.click(screen.getByRole('button', { name: 'First' }))
    expect((await screen.findByRole('status')).textContent).toBe('That change was not kept.')
    expect(screen.getByRole('button', { name: 'Second' }).getAttribute('aria-current')).toBe('true')
  })

  it('does not mark a piece done when that save does not land', async () => {
    const user = setupUser()
    renderStudy(scriptedStore([true, true, false]))
    expect(await screen.findByRole('textbox', { name: 'Paste text' })).toBeTruthy()
    setPaste('Alpha\n\nBeta')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    typeAll('Alpha')
    expect((await screen.findByRole('status')).textContent).toBe('This piece was not marked done. It will come up again.')
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByText('Piece 1 of 2')).toBeTruthy()
  })

  it('refuses another text when the library is full', async () => {
    const user = setupUser()
    let library = emptyStudyLibrary()
    for (let index = 0; index < STUDY_SOURCE_MAX; index += 1) {
      const made = studySourceFromText(`Note ${index}`, 'Hi', `id-${index}`, index)
      if ('error' in made) throw new Error(made.error)
      const next = addStudySource(library, made)
      if ('error' in next) throw new Error(next.error)
      library = next
    }
    renderStudy(createMemoryStudyStore(library))
    expect(await screen.findByRole('button', { name: 'Note 0' })).toBeTruthy()
    setPaste('Hello')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    expect((await screen.findByRole('status')).textContent).toBe('The library is full. Remove a text first.')
  })

  it('ignores a library that arrives after the page is gone', async () => {
    let resolveLoad: (result: { ok: true; library: StudyLibrary }) => void = () => {}
    const store: StudyStore = {
      load: () =>
        new Promise((resolve) => {
          resolveLoad = resolve
        }),
      save: async () => true,
    }
    const view = renderStudy(store)
    expect(screen.getByText('Opening your library.')).toBeTruthy()
    view.unmount()
    resolveLoad({ ok: true, library: emptyStudyLibrary() })
    await Promise.resolve()
  })
})

function passage() {
  const node = document.querySelector('.whitespace-pre-wrap')
  if (!node?.textContent) throw new Error('passage text was not on screen')
  return node.textContent
}
