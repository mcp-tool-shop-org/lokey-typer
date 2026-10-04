import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { findExercise, type Mode } from '@content'
import {
  getOrCreateUserId,
  isTemplateExercise,
  localDateKey,
  renderTemplateExercise,
  topCompetitiveRuns,
  type SprintDurationMs,
} from '@lib'
import { usePreferences } from '@app'
import { Icon } from '@app/components/Icon'
import { TypingSession } from '@features/typing'
import { keyboardPassage } from '@lib-internal/keyboardPassage'
import { competitiveMinLength, repeatPassage } from '@lib-internal/repeatPassage'
import { useDocumentTitle } from '@app/useDocumentTitle'

function modeHome(mode: Mode): string {
  if (mode === 'real_life') return '/real-life'
  if (mode === 'competitive') return '/competitive'
  return '/focus'
}

export function RunPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const params = useParams<{ exerciseId: string }>()
  const [search] = useSearchParams()
  const { prefs } = usePreferences()
  const [sessionKey, setSessionKey] = useState(0)
  const [boardEpoch, setBoardEpoch] = useState(0)

  const exerciseId = params.exerciseId ?? ''
  const exercise = findExercise(exerciseId)

  const variant = (search.get('variant') === 'long' ? 'long' : 'short') as 'short' | 'long'
  const ghost = mode === 'competitive' && prefs.competitiveGhostEnabled && search.get('ghost') !== '0'

  const sprintDurationMs = useMemo(() => {
    if (mode !== 'competitive') return undefined
    const raw = search.get('duration')
    if (raw === '30000') return 30_000
    if (raw === '60000') return 60_000
    if (raw === '120000') return 120_000
    return prefs.competitiveSprintDurationMs
  }, [mode, prefs.competitiveSprintDurationMs, search])

  const targetText = useMemo(() => {
    if (!exercise) return ''

    const userId = getOrCreateUserId()
    const dateKey = localDateKey()

    const base = isTemplateExercise(exercise)
      ? renderTemplateExercise(exercise, { dateKey, seed: `${userId}|${exercise.id}|${dateKey}` })
      : variant === 'long'
        ? (exercise.text_long ?? exercise.text_short ?? exercise.text ?? '')
        : (exercise.text_short ?? exercise.text ?? exercise.text_long ?? '')

    const folded = keyboardPassage(base)
    if (mode === 'competitive' && !prefs.screenReaderMode) {
      // keep sprints going without running out of target text
      return repeatPassage(folded, competitiveMinLength(sprintDurationMs))
    }
    return folded
  }, [exercise, mode, variant, prefs.screenReaderMode, sprintDurationMs])

  // A screen-reader toggle (or a restart) starts a fresh passage. The attempt keeps the text it opened with.
  const attemptIdentity = `${exercise?.id ?? ''}|${mode}|${variant}|${sprintDurationMs ?? 0}|${sessionKey}|${prefs.screenReaderMode ? 'sr' : 'plain'}`
  const [attempt, setAttempt] = useState({ identity: '', text: '' })
  if (attempt.identity !== attemptIdentity) {
    setAttempt({ identity: attemptIdentity, text: targetText })
  }
  const attemptText = attempt.identity === attemptIdentity ? attempt.text : targetText
  // boardEpoch changes after a saved finish. The read stays in render, and the attempt is not remounted.
  const topRuns =
    mode === 'competitive' && boardEpoch >= 0
      ? topCompetitiveRuns({ durationMs: sprintDurationMs ?? 60_000, limit: 3 })
      : []

  useDocumentTitle(exercise ? `${exercise.title} — LoKey Typer` : 'Exercise not found — LoKey Typer')

  if (!exercise) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-zinc-900/40 px-6 py-8 text-center sm:px-8 sm:py-12">
        <Icon name="search" size={28} className="text-zinc-500" />
        <div>
          <h1 className="text-sm font-semibold text-zinc-50">Exercise not found</h1>
          <div className="mt-1 text-sm text-zinc-400">
            <span className="font-mono text-zinc-400">{exerciseId}</span> doesn't exist or was removed.
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(modeHome(mode))}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/80 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition duration-150 hover:bg-zinc-700 hover:border-zinc-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Icon name="arrow-left" size={14} className="shrink-0" />
          Go back
        </button>
      </div>
    )
  }

  const showCompetitiveHud = mode === 'competitive'

  return (
    <div className="space-y-6">
      {mode === 'competitive' ? (
        <div className="rounded-2xl bg-zinc-900/40 p-5 text-sm text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon name="timer" size={14} className="shrink-0 text-zinc-400" />
              Sprint: <span className="text-zinc-50">{(sprintDurationMs ?? 60_000) / 1000}s</span>
              {ghost ? (
                <span className="ml-1 flex items-center gap-1.5 text-zinc-400">
                  <Icon name="ghost" size={14} className="shrink-0" /> Ghost comparison
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => navigate('/daily')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none transition duration-150 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <Icon name="arrow-left" size={14} className="shrink-0" />
              Daily
            </button>
          </div>
          <div className="mt-3 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Icon name="trophy" size={14} className="shrink-0 text-zinc-500" />
              Leaderboard (local) — top WPM for this duration:
            </div>
            {topRuns.length === 0 ? (
              <div className="mt-2">No runs yet — finish a sprint to get on the board.</div>
            ) : (
              <div className="mt-2 grid gap-1">
                {topRuns.map((r, i) => {
                  const medalIcon = i === 0 ? 'medal-gold' as const : i === 1 ? 'medal-silver' as const : 'medal-bronze' as const
                  return (
                    <div key={`${r.timestamp}-${i}`} className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors duration-200 hover:bg-zinc-800/40">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Icon name={medalIcon} size={14} className="shrink-0" />
                        #{i + 1}
                      </div>
                      <div className="text-zinc-200">{Math.round(r.wpm)} WPM</div>
                      <div className="text-zinc-400">{Math.round(r.accuracy * 1000) / 10}%</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <TypingSession
        key={attemptIdentity}
        mode={mode}
        exercise={exercise}
        targetText={attemptText}
        prefs={prefs}
        sprintDurationMs={mode === 'competitive' ? (sprintDurationMs as SprintDurationMs) : undefined}
        showCompetitiveHud={showCompetitiveHud}
        ghostEnabled={ghost}
        onExit={() => navigate(modeHome(mode))}
        onRestart={() => setSessionKey((key) => key + 1)}
        onComplete={
          mode === 'competitive' ? () => setBoardEpoch((epoch) => epoch + 1) : undefined
        }
      />
    </div>
  )
}
