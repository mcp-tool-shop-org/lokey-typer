import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '@content'
import {
  activeStudySource,
  addStudySource,
  advanceStudyPlace,
  createIndexedDbStudyStore,
  emptyStudyLibrary,
  ensureStudyDeck,
  openStudySource,
  projectStudy,
  removeStudySource,
  restartStudySource,
  setStudyOrder,
  studyNameFromFile,
  studySourceFromText,
  type StudyLibrary,
  type StudyOrder,
  type StudyStore,
} from '@lib'
import { usePreferences } from '@app'
import { useDocumentTitle } from '@app/useDocumentTitle'
import { TypingSession } from '@features/typing'

const PRIMARY =
  'inline-flex items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/80 px-5 py-2.5 text-sm font-semibold text-zinc-100 transition duration-150 hover:border-zinc-600 hover:bg-zinc-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-40'
const QUIET =
  'inline-flex items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200 outline-none transition duration-150 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'
const FIELD =
  'w-full rounded-lg border border-zinc-700/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors duration-200 focus:border-zinc-500/70 focus-visible:ring-2 focus-visible:ring-zinc-200/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'

type Phase = 'loading' | 'failed' | 'ready'

type RunSnapshot = {
  exerciseId: string
  title: string
  pack: string
  text: string
}

export function StudyPage({
  store,
  rng,
  createId,
}: {
  store?: StudyStore
  rng?: () => number
  createId?: () => string
} = {}) {
  const fallbackStore = useMemo(() => createIndexedDbStudyStore(), [])
  const resolved = store ?? fallbackStore
  const { prefs } = usePreferences()
  const screenReader = Boolean(prefs.screenReaderMode)
  const rngRef = useRef(rng ?? Math.random)
  rngRef.current = rng ?? Math.random
  const idRef = useRef(createId ?? (() => crypto.randomUUID()))
  const libraryRef = useRef<StudyLibrary>(emptyStudyLibrary())
  const servedPlace = useRef<number | null>(null)
  const busy = useRef(false)
  const readerRef = useRef(screenReader)

  const [phase, setPhase] = useState<Phase>('loading')
  const [library, setLibrary] = useState<StudyLibrary>(emptyStudyLibrary)
  const [typing, setTyping] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [run, setRun] = useState<RunSnapshot | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [paste, setPaste] = useState('')
  const [name, setName] = useState('')

  libraryRef.current = library
  const view = projectStudy(library, screenReader)

  useDocumentTitle(typing && run ? `${run.title} — LoKey Typer` : 'Study — LoKey Typer')

  useEffect(() => {
    let cancelled = false
    void resolved.load().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setPhase('failed')
        return
      }
      setLibrary(result.library)
      setPhase('ready')
    })
    return () => {
      cancelled = true
    }
  }, [resolved])

  useEffect(() => {
    if (readerRef.current === screenReader) return
    readerRef.current = screenReader
    setTyping(false)
    setRun(null)
  }, [screenReader])

  async function commit(next: StudyLibrary, failure: string): Promise<boolean> {
    const ok = await resolved.save(next)
    if (!ok) {
      setNotice(failure)
      return false
    }
    setNotice(null)
    setLibrary(next)
    return true
  }

  async function addText(rawName: string, text: string) {
    if (busy.current) return
    busy.current = true
    try {
      const made = studySourceFromText(rawName, text, idRef.current(), Date.now())
      if ('error' in made) {
        setNotice(made.error)
        return
      }
      const next = addStudySource(libraryRef.current, made)
      if ('error' in next) {
        setNotice(next.error)
        return
      }
      const kept = await commit(next, 'That text was not kept.')
      if (!kept) return
      setPaste('')
      setName('')
    } finally {
      busy.current = false
    }
  }

  async function addFile(file: File) {
    let text = ''
    try {
      text = await file.text()
    } catch {
      setNotice('That file could not be read.')
      return
    }
    await addText(studyNameFromFile(file.name), text)
  }

  async function chooseOrder(order: StudyOrder) {
    const next = setStudyOrder(libraryRef.current, order)
    if (next === libraryRef.current) return
    await commit(next, 'That change was not kept.')
  }

  async function chooseSource(id: string) {
    const next = openStudySource(libraryRef.current, id)
    if (next === libraryRef.current) return
    await commit(next, 'That change was not kept.')
  }

  async function removeSource(id: string) {
    await commit(removeStudySource(libraryRef.current, id), 'That change was not kept.')
  }

  async function begin() {
    if (busy.current) return
    busy.current = true
    try {
      let current = libraryRef.current
      const repaired = ensureStudyDeck(current, screenReader, rngRef.current)
      if (repaired.changed) {
        const ok = await resolved.save(repaired.library)
        if (!ok) {
          setNotice(
            repaired.reshuffled
              ? 'This order could not be saved, so the piece was not started.'
              : 'This library could not be saved. It stays until you leave this page.',
          )
          if (repaired.reshuffled) return
          setLibrary(repaired.library)
        } else {
          setNotice(null)
          setLibrary(repaired.library)
        }
        current = repaired.library
      }
      const projected = projectStudy(current, screenReader)
      if (!projected.chunk || !projected.source) return
      servedPlace.current = projected.place
      setRun({
        exerciseId: `study-${projected.source.id}-${projected.place}`,
        title: projected.source.name,
        pack: `Piece ${projected.place + 1} of ${projected.count}`,
        text: projected.chunk,
      })
      setAttempt((value) => value + 1)
      setTyping(true)
    } finally {
      busy.current = false
    }
  }

  async function startOver() {
    if (busy.current) return
    busy.current = true
    try {
      const next = restartStudySource(libraryRef.current, screenReader, rngRef.current)
      await commit(next, 'That change was not kept.')
    } finally {
      busy.current = false
    }
  }

  async function handleComplete() {
    const current = libraryRef.current
    const source = activeStudySource(current)
    if (!source || servedPlace.current == null || source.place !== servedPlace.current) return
    const place = servedPlace.current
    const next = advanceStudyPlace(current)
    const ok = await resolved.save(next)
    if (!ok) {
      servedPlace.current = place
      setNotice('This piece was not marked done. It will come up again.')
      return
    }
    servedPlace.current = null
    setLibrary(next)
  }

  const exercise: Exercise | null = run
    ? {
        id: run.exerciseId,
        mode: 'focus',
        pack: run.pack,
        title: run.title,
        difficulty: 1,
        estimated_seconds: Math.max(15, Math.round(run.text.length / 12)),
        tags: [],
        text: run.text,
      }
    : null

  const primaryLabel = !view.source ? 'Start' : view.finished ? 'Start again' : view.place === 0 ? 'Start' : 'Continue'

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {notice ? (
        <p role="status" className="text-sm font-medium text-zinc-200">
          {notice}
        </p>
      ) : null}

      {typing && run && exercise ? (
        <TypingSession
          key={`${run.exerciseId}-${attempt}`}
          mode="focus"
          exercise={exercise}
          targetText={run.text}
          prefs={prefs}
          showCompetitiveHud={false}
          recordRun={false}
          onExit={() => {
            setTyping(false)
            setRun(null)
          }}
          onRestart={() => setAttempt((value) => value + 1)}
          onComplete={() => {
            void handleComplete()
          }}
        />
      ) : phase === 'loading' ? (
        <p role="status" className="text-sm text-zinc-400">
          Opening your library.
        </p>
      ) : phase === 'failed' ? (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Study</h1>
          <p role="status" className="text-sm text-zinc-200">
            This library could not be opened.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Study</h1>
            {library.sources.length === 0 ? (
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
                Add a text file, or paste a passage. It stays on this device and comes back one piece at a time,
                including after a restart.
              </p>
            ) : null}
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void addText(name, paste)
            }}
          >
            <div className="flex flex-wrap gap-2">
              <label className={QUIET}>
                Add a text file
                <input
                  type="file"
                  accept=".txt,.text,.md,.markdown,text/plain,text/markdown"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.currentTarget.value = ''
                    if (file) void addFile(file)
                  }}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">Paste text</span>
              <textarea
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                rows={5}
                className={FIELD}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={FIELD}
              />
            </label>
            <button type="submit" className={PRIMARY}>
              Add text
            </button>
          </form>

          {library.sources.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div role="group" aria-label="Order" className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={library.order === 'in_order'}
                    className={library.order === 'in_order' ? PRIMARY : QUIET}
                    onClick={() => {
                      void chooseOrder('in_order')
                    }}
                  >
                    In order
                  </button>
                  <button
                    type="button"
                    aria-pressed={library.order === 'random'}
                    className={library.order === 'random' ? PRIMARY : QUIET}
                    onClick={() => {
                      void chooseOrder('random')
                    }}
                  >
                    Shuffled
                  </button>
                </div>
                <p className="text-xs text-zinc-400">Changing the order starts this text from the beginning.</p>
              </div>

              <ul className="space-y-2">
                {library.sources.map((source) => {
                  const active = source.id === library.activeId
                  return (
                    <li key={source.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        className={active ? PRIMARY : QUIET}
                        onClick={() => {
                          void chooseSource(source.id)
                        }}
                      >
                        {source.name}
                      </button>
                      <button
                        type="button"
                        className={QUIET}
                        onClick={() => {
                          void removeSource(source.id)
                        }}
                      >
                        {`Remove ${source.name}`}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {view.source ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    {view.count === 0
                      ? 'This text has no pieces to type.'
                      : view.finished
                        ? `You've finished ${view.source.name}.`
                        : `Piece ${view.place + 1} of ${view.count}`}
                  </p>
                  <button
                    type="button"
                    className={PRIMARY}
                    disabled={view.count === 0}
                    onClick={() => {
                      if (view.finished) void startOver()
                      else void begin()
                    }}
                  >
                    {primaryLabel}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
