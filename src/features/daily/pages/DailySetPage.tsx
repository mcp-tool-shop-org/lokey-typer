import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { findExercise } from '@content'
import type { Exercise } from '@content'
import {
  generateDailySet,
  getOrCreateUserId,
  isTemplateExercise,
  loadDailyProgress,
  loadRuns,
  loadSkillModel,
  renderTemplateExercise,
  saveDailyProgress,
  type DailyItemResult,
  type DailyProgress,
  type DailySessionType,
  type DailySet,
  type DailySetItemKind,
} from '@lib'
import { usePreferences } from '@app'
import { Icon, type IconName } from '@app/components/Icon'
import { TypingSession } from '@features/typing'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kindLabel(kind: DailySetItemKind) {
  if (kind === 'confidence') return 'Confidence win'
  if (kind === 'targeted') return 'Targeted practice'
  if (kind === 'challenge') return 'Challenge'
  if (kind === 'real_life') return 'Real-life scenario'
  return 'Mix'
}

function kindIcon(kind: DailySetItemKind): IconName {
  if (kind === 'confidence') return 'kind-confidence'
  if (kind === 'targeted') return 'kind-targeted'
  if (kind === 'challenge') return 'kind-challenge'
  if (kind === 'real_life') return 'kind-real-life'
  return 'kind-mix'
}

function sessionLabel(type: DailySessionType) {
  if (type === 'reset') return 'Short set'
  if (type === 'deep') return 'Long set'
  return 'Standard set'
}

function computeDaysPracticed(runs: ReturnType<typeof loadRuns>) {
  const days = new Set<string>()
  for (const r of runs) {
    const d = new Date(r.timestamp * 1000).toISOString().slice(0, 10)
    days.add(d)
  }
  return days
}

function computeBestWeek(days: Set<string>) {
  const sorted = Array.from(days).sort()
  if (sorted.length === 0) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  const dayMs = sorted.map((d) => new Date(d).getTime())
  let best = 1
  let i = 0
  for (let j = 0; j < dayMs.length; j++) {
    while (dayMs[j] - dayMs[i] > 6 * msPerDay) i++
    best = Math.max(best, j - i + 1)
  }
  return best
}

function resolveExerciseText(exercise: Exercise): string {
  if (isTemplateExercise(exercise)) {
    return renderTemplateExercise(exercise, { seed: `daily|${exercise.id}|${Date.now()}` })
  }
  return exercise.text_short ?? exercise.text ?? exercise.text_long ?? ''
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

type PagePhase =
  | 'idle'
  | 'typing'
  | 'transition'
  | 'summary'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailySetPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { prefs } = usePreferences()

  const type = (search.get('type') ?? '') as DailySessionType
  const sessionType: DailySessionType = type === 'reset' || type === 'mix' || type === 'deep' ? type : 'mix'

  const userId = useMemo(() => getOrCreateUserId(), [])
  const skill = useMemo(() => loadSkillModel(), [])

  const daily: DailySet = useMemo(() => {
    return generateDailySet({
      userId,
      sessionType,
      weakTags: skill.weak_tags,
      skill,
    })
  }, [userId, sessionType, skill])

  // ---- Progress persistence ----

  const [progress, setProgress] = useState<DailyProgress>(() => {
    const existing = loadDailyProgress(daily.dateKey, userId)
    if (existing && existing.sessionType === sessionType) return existing
    return {
      dateKey: daily.dateKey,
      userId,
      sessionType,
      completedItems: [],
      startedAt: Date.now(),
    }
  })

  // Reset progress if session type changes (different set = different exercises).
  useEffect(() => {
    const existing = loadDailyProgress(daily.dateKey, userId)
    if (existing && existing.sessionType === sessionType) {
      setProgress(existing)
    } else {
      setProgress({
        dateKey: daily.dateKey,
        userId,
        sessionType,
        completedItems: [],
        startedAt: Date.now(),
      })
    }
  }, [daily.dateKey, userId, sessionType])

  // ---- Phase state ----

  const currentIndex = progress.completedItems.length
  const isFinished = currentIndex >= daily.items.length

  const [phase, setPhase] = useState<PagePhase>(() => {
    if (isFinished) return 'summary'
    return 'idle'
  })

  // Sync phase if progress loads as finished (e.g. page reload after completing).
  useEffect(() => {
    if (isFinished && phase !== 'summary') setPhase('summary')
  }, [isFinished, phase])

  const [sessionKey, setSessionKey] = useState(0)
  const phaseRef = useRef<HTMLDivElement>(null)

  // Scroll phase content into view on transitions
  useEffect(() => {
    if (phase === 'transition' || phase === 'summary') {
      phaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [phase])

  // ---- Current exercise ----

  const currentItem = daily.items[currentIndex] ?? null
  const currentExercise = currentItem ? findExercise(currentItem.exerciseId) : null

  // ---- Stats (for idle phase) ----

  const daysPracticed = useMemo(() => computeDaysPracticed(loadRuns()), [])
  const bestWeek = useMemo(() => computeBestWeek(daysPracticed), [daysPracticed])

  // ---- Handlers ----

  const handleBegin = useCallback(() => {
    setPhase('typing')
  }, [])

  const handleComplete = useCallback(
    (result: { wpm: number; accuracy: number; durationMs: number }) => {
      const item: DailyItemResult = {
        wpm: result.wpm,
        accuracy: result.accuracy,
        durationMs: result.durationMs,
        completedAt: Date.now(),
      }

      const nextCompleted = [...progress.completedItems, item]
      const isLast = nextCompleted.length >= daily.items.length

      const nextProgress: DailyProgress = {
        ...progress,
        completedItems: nextCompleted,
        finishedAt: isLast ? Date.now() : undefined,
      }

      saveDailyProgress(nextProgress)
      setProgress(nextProgress)

      if (isLast) {
        setPhase('summary')
      } else {
        setPhase('transition')
      }
    },
    [progress, daily.items.length],
  )

  const handleExit = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleRestart = useCallback(() => {
    setSessionKey((k) => k + 1)
  }, [])

  // ---- Transition auto-advance ----

  useEffect(() => {
    if (phase !== 'transition') return
    const id = window.setTimeout(() => {
      setSessionKey((k) => k + 1)
      setPhase('typing')
    }, 1500)
    return () => window.clearTimeout(id)
  }, [phase])

  // ---- Render ----

  return (
    <div className="mx-auto max-w-3xl space-y-14">
      {/* Screen reader phase announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {phase === 'typing' && currentExercise
          ? `Exercise ${currentIndex + 1} of ${daily.items.length}: ${currentExercise.title}`
          : phase === 'transition'
            ? `Exercise complete. ${currentIndex} of ${daily.items.length} done.`
            : phase === 'summary'
              ? 'Daily set complete.'
              : null}
      </div>

      {/* CTA — same position as every other tab (idle only) */}
      {phase === 'idle' ? (
        <div className="text-center">
          <button
            type="button"
            onClick={handleBegin}
            className="group inline-flex items-center gap-2.5 rounded-2xl border border-zinc-700/50 bg-zinc-800/80 px-12 py-4 text-base font-semibold text-zinc-300 transition-all duration-150 hover:bg-zinc-700 hover:border-zinc-600 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Icon name="play" size={20} className="text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" />
            {currentIndex > 0 ? 'Continue' : 'Begin'}
          </button>
          <div className="mt-3 text-xs text-zinc-500/80">
            {daily.items.length} exercises • {sessionLabel(sessionType)}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(
              [
                { key: 'reset' as const, label: sessionLabel('reset') },
                { key: 'mix' as const, label: sessionLabel('mix') },
                { key: 'deep' as const, label: sessionLabel('deep') },
              ]
            ).map((t) => (
              <Link
                key={t.key}
                to={`/daily?type=${t.key}`}
                className={
                  'no-underline rounded-full border px-4 py-2 text-xs font-semibold outline-none transition-all duration-150 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
                  (sessionType === t.key
                    ? 'border-slate-600/70 bg-zinc-900 text-zinc-50'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200')
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Progress bar — shown during typing/transition */}
      {phase === 'typing' || phase === 'transition' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Exercise {currentIndex + 1} of {daily.items.length}</span>
            <span>{sessionLabel(sessionType)}</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuenow={currentIndex + (phase === 'transition' ? 1 : 0)}
            aria-valuemin={0}
            aria-valuemax={daily.items.length}
            aria-label="Exercise progress"
          >
            <div
              className="h-full rounded-full bg-slate-500/80 transition-all duration-700 ease-out"
              style={{ width: `${((currentIndex + (phase === 'transition' ? 1 : 0)) / daily.items.length) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* ---- IDLE PHASE ---- */}
      {phase === 'idle' ? (
        <>
          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-900/40 p-6 text-sm text-zinc-300">
              <Icon name="stat-days" size={20} className="mt-0.5 shrink-0 text-zinc-500" />
              <div>
                <div className="text-xs font-medium text-zinc-400">Days practiced</div>
                <div className="mt-1 text-lg font-semibold leading-tight text-zinc-50 tabular-nums">{daysPracticed.size}</div>
                <div className="mt-1 text-xs leading-relaxed text-zinc-500">Every day you show up counts.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-zinc-900/40 p-6 text-sm text-zinc-300">
              <Icon name="stat-streak" size={20} className="mt-0.5 shrink-0 text-zinc-500" />
              <div>
                <div className="text-xs font-medium text-zinc-400">Best week</div>
                <div className="mt-1 text-lg font-semibold leading-tight text-zinc-50 tabular-nums">{bestWeek}/7 days</div>
                <div className="mt-1 text-xs leading-relaxed text-zinc-500">Most days typed in any 7-day window.</div>
              </div>
            </div>
          </div>

          {/* Exercise preview list */}
          <div className="rounded-3xl bg-zinc-900/40 p-5 sm:p-8">
            <h2 className="text-sm font-semibold text-zinc-50">Today's exercises</h2>

            <div className="mt-5 grid gap-1.5">
              {daily.items.map((it, idx) => {
                const ex = findExercise(it.exerciseId)
                if (!ex) return null
                const done = idx < progress.completedItems.length
                return (
                  <div
                    key={`${daily.dateKey}-${idx}`}
                    className={
                      'flex items-center gap-3 rounded-xl px-5 py-3.5 transition-all duration-200 ' +
                      (done
                        ? 'bg-zinc-800/30 text-zinc-500'
                        : 'bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/40 hover:scale-[1.005] active:scale-[0.995]')
                    }
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs font-semibold text-zinc-400">
                      {done ? (
                        <Icon name="checkmark-circle" size={14} className="text-slate-500" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                        <Icon name={kindIcon(it.kind)} size={14} className="shrink-0 text-zinc-500" />
                        {kindLabel(it.kind)}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold tracking-tight text-zinc-200">{ex.title}</div>
                    </div>
                    {done ? (
                      <div className="text-xs tabular-nums text-zinc-500">
                        {Math.round(progress.completedItems[idx].wpm)} wpm
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* ---- TYPING PHASE: missing exercise fallback ---- */}
      {phase === 'typing' && currentItem && !currentExercise ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-zinc-900/40 px-6 py-8 text-center sm:px-8 sm:py-12">
          <Icon name="search" size={28} className="text-zinc-500" />
          <div>
            <div className="text-sm font-semibold text-zinc-200">Exercise unavailable</div>
            <div className="mt-1 text-xs text-zinc-500">
              Couldn't load exercise <span className="font-mono text-zinc-400">{currentItem.exerciseId}</span>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              // Skip this exercise and advance
              handleComplete({ wpm: 0, accuracy: 0, durationMs: 0 })
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/80 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition duration-150 hover:bg-zinc-700 hover:border-zinc-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Skip to next
          </button>
        </div>
      ) : null}

      {/* ---- TYPING PHASE ---- */}
      {phase === 'typing' && currentExercise && currentItem ? (
        <div className="space-y-4">
          {/* Exercise kind label */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Icon name={kindIcon(currentItem.kind)} size={16} className="shrink-0 text-zinc-500" />
            <span className="font-medium">{kindLabel(currentItem.kind)}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">{currentExercise.title}</span>
          </div>

          <TypingSession
            key={`daily-${currentIndex}-${sessionKey}`}
            mode={currentItem.mode}
            exercise={currentExercise}
            targetText={resolveExerciseText(currentExercise)}
            prefs={prefs}
            showCompetitiveHud={false}
            ghostEnabled={false}
            onExit={handleExit}
            onRestart={handleRestart}
            onComplete={handleComplete}
          />
        </div>
      ) : null}

      {/* ---- TRANSITION PHASE ---- */}
      {phase === 'transition' ? (() => {
        const nextIndex = currentIndex
        const nextItem = daily.items[nextIndex]
        const nextExercise = nextItem ? findExercise(nextItem.exerciseId) : null
        return (
          <div ref={phaseRef} className="flex flex-col items-center gap-4 rounded-3xl bg-zinc-900/40 px-6 py-10 text-center animate-fade-in sm:px-8 sm:py-16">
            <Icon name="checkmark-circle" size={32} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-zinc-200">Nice!</h2>
            {nextItem && nextExercise ? (
              <div className="text-sm text-zinc-400">
                Next up: <span className="font-medium text-zinc-300">{kindLabel(nextItem.kind)}</span>
                <span className="text-zinc-600"> — </span>
                <span className="text-zinc-500">{nextExercise.title}</span>
              </div>
            ) : null}
          </div>
        )
      })() : null}

      {/* ---- SUMMARY PHASE ---- */}
      {phase === 'summary' ? (() => {
        const items = progress.completedItems
        const avgWpm = items.length > 0 ? Math.round(items.reduce((s, r) => s + r.wpm, 0) / items.length) : 0
        const avgAccuracy = items.length > 0 ? items.reduce((s, r) => s + r.accuracy, 0) / items.length : 0
        const totalMs = items.reduce((s, r) => s + r.durationMs, 0)

        return (
          <div ref={phaseRef} className="mx-auto max-w-3xl space-y-14 animate-fade-in">
            {/* Summary header */}
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-zinc-900/40 px-6 py-10 text-center sm:px-8 sm:py-14">
              <Icon name="trophy" size={28} className="text-slate-400" />
              <h1 className="text-xl font-semibold text-zinc-100">Daily Set Complete!</h1>
              <div className="mt-2 flex flex-wrap justify-center gap-6 text-sm">
                <div>
                  <div className="text-xs font-medium text-zinc-400">Avg WPM</div>
                  <div className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-zinc-100">{avgWpm}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-400">Avg Accuracy</div>
                  <div className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-zinc-100">
                    {(avgAccuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-400">Total Time</div>
                  <div className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-zinc-100">{formatDuration(totalMs)}</div>
                </div>
              </div>
            </div>

            {/* Per-exercise results */}
            <div className="rounded-3xl bg-zinc-900/40 p-5 sm:p-8">
              <h2 className="text-sm font-semibold text-zinc-200">Exercise breakdown</h2>
              <div className="mt-5 grid gap-1.5">
                {daily.items.map((it, idx) => {
                  const ex = findExercise(it.exerciseId)
                  const result = items[idx]
                  if (!ex || !result) return null
                  return (
                    <div
                      key={`summary-${idx}`}
                      className="flex items-center gap-3 rounded-xl bg-zinc-900/30 px-5 py-3.5 transition-all duration-200 hover:bg-zinc-800/40"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs font-semibold text-zinc-400">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <Icon name={kindIcon(it.kind)} size={14} className="shrink-0 text-zinc-500" />
                          {kindLabel(it.kind)}
                        </div>
                        <div className="mt-0.5 truncate text-sm text-zinc-300">{ex.title}</div>
                      </div>
                      <div className="flex gap-4 text-xs tabular-nums text-zinc-400">
                        <span>{Math.round(result.wpm)} wpm</span>
                        <span>{(result.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Back to home */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700/50 bg-zinc-800/80 px-6 py-3 text-sm font-semibold text-zinc-300 transition duration-150 hover:bg-zinc-700 hover:border-zinc-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                Back to Home
              </button>
            </div>
          </div>
        )
      })() : null}
    </div>
  )
}
