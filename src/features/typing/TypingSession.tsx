import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise, Mode } from '@content'
import { Icon, type IconName } from '@app/components/Icon'
import {
  appendRun,
  bestAccuracyForExercise,
  bestWpmForExercise,
  buildFeedback,
  computeLiveMetrics,
  getPersonalBest,
  loadSkillModel,
  maybeUpdatePersonalBest,
  pushRecent,
  saveLastMode,
  saveSkillModel,
  type Preferences,
  type SprintDurationMs,
  typewriterAudio,
  updateSkillModelFromRun,
} from '@lib'
import { useAmbient } from '@app'
import { TypingOverlay } from './TypingOverlay'

function fnv1a32Hex(input: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function computeTagsHit(params: { exercise: Exercise; targetText: string }): string[] {
  const tags = new Set<string>()

  const t = params.targetText
  if (t.includes('\n')) tags.add('multiline')
  if (/[0-9]/.test(t)) tags.add('numbers')
  if (/[.,;:?!]/.test(t)) tags.add('punctuation')
  if (/["“”]/.test(t)) tags.add('quotes')
  if (/[’']/.test(t)) tags.add('apostrophe')
  if (/[-–—]/.test(t)) tags.add('dashes')
  if (
    t.includes('(') ||
    t.includes(')') ||
    t.includes('[') ||
    t.includes(']') ||
    t.includes('{') ||
    t.includes('}') ||
    t.includes('<') ||
    t.includes('>')
  )
    tags.add('brackets')
  if (/[\\/]/.test(t)) tags.add('slashes')

  // Preserve any content-provided tags that match our tracked set.
  const tracked = new Set(['multiline', 'numbers', 'punctuation', 'quotes', 'apostrophe', 'dashes', 'brackets', 'slashes'])
  for (const exTag of params.exercise.tags ?? []) {
    if (tracked.has(exTag)) tags.add(exTag)
  }

  return Array.from(tags)
}

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return (
    <div className="min-w-[5.5rem] rounded-2xl bg-zinc-900/40 p-4 transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        {icon ? <Icon name={icon} size={14} className="shrink-0 text-zinc-500" /> : null}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold leading-tight text-zinc-50 tabular-nums">{value}</div>
    </div>
  )
}

export function TypingSession(props: {
  mode: Mode
  exercise: Exercise
  targetText: string
  prefs: Preferences
  sprintDurationMs?: SprintDurationMs
  showCompetitiveHud: boolean
  ghostEnabled?: boolean
  onExit: () => void
  onRestart: () => void
  onComplete?: (result: { wpm: number; accuracy: number; durationMs: number }) => void
}) {
  const { targetText } = props
  const [typed, setTyped] = useState('')
  const [backspaces, setBackspaces] = useState(0)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [endedAtMs, setEndedAtMs] = useState<number | null>(null)
  const [, setInputFocused] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const endOnceRef = useRef(false)

  const timeLimitMs = props.sprintDurationMs

  // Auto-focus textarea when session mounts.
  useEffect(() => {
    // Small delay lets the DOM settle after React render.
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = Date.now()
      setNowMs(n)

      if (timeLimitMs != null && startedAtMs != null && endedAtMs == null) {
        if (n - startedAtMs >= timeLimitMs) setEndedAtMs(startedAtMs + timeLimitMs)
      }
    }, 100)
    return () => window.clearInterval(t)
  }, [timeLimitMs, startedAtMs, endedAtMs])

  const effectiveNowMs = endedAtMs ?? nowMs

  const elapsedMs = startedAtMs == null ? 0 : Math.max(0, effectiveNowMs - startedAtMs)
  const remainingMs =
    timeLimitMs == null
      ? null
      : startedAtMs == null
        ? timeLimitMs
        : Math.max(0, timeLimitMs - Math.max(0, effectiveNowMs - startedAtMs))

  const elapsedForMetrics = timeLimitMs == null ? elapsedMs : Math.min(elapsedMs, timeLimitMs)

  const live = useMemo(
    () => computeLiveMetrics({ target: targetText, typed, elapsedMs: elapsedForMetrics }),
    [targetText, typed, elapsedForMetrics],
  )

  const isComplete = endedAtMs != null

  const { noteTypingActivity } = useAmbient()

  useEffect(() => {
    if (!isComplete || endedAtMs == null) return
    if (endOnceRef.current) return
    endOnceRef.current = true

    const timestamp = Math.floor(endedAtMs / 1000)

    const run = {
      exercise_id: props.exercise.id,
      timestamp,
      mode: props.mode,
      rendered_text_hash: fnv1a32Hex(targetText),
      wpm: live.wpm,
      accuracy: live.accuracy,
      errors: live.errors,
      backspaces,
      duration_ms: timeLimitMs ?? Math.max(0, endedAtMs - (startedAtMs ?? endedAtMs)),
      tags_hit: computeTagsHit({ exercise: props.exercise, targetText }),
      sprint_duration_ms: timeLimitMs as SprintDurationMs | undefined,
    }

    appendRun(run)
    pushRecent(props.mode, props.exercise.id)
    saveLastMode(props.mode)

    // Phase 3: update local skill model (adaptive selection foundation).
    try {
      const prev = loadSkillModel()
      const next = updateSkillModelFromRun({
        prev,
        run,
        exercise: props.exercise,
        targetText,
        typedText: typed,
      })
      saveSkillModel(next)
    } catch {
      // ignore
    }

    // PB update (competitive only, but harmless)
    maybeUpdatePersonalBest({
      exerciseId: props.exercise.id,
      sprintDurationMs: timeLimitMs as SprintDurationMs | undefined,
      wpm: run.wpm,
      accuracy: run.accuracy,
      timestamp,
    })

    if (props.prefs.bellOnCompletion) {
      typewriterAudio.play('return_bell', {
        enabled: props.prefs.soundEnabled,
        volume: props.prefs.volume,
        modeGain: props.mode === 'focus' ? 0.7 : props.mode === 'competitive' ? 1.0 : 0.85,
      })
    }

    props.onComplete?.({
      wpm: run.wpm,
      accuracy: run.accuracy,
      durationMs: run.duration_ms,
    })
  }, [
    isComplete,
    endedAtMs,
    backspaces,
    live.accuracy,
    live.errors,
    live.wpm,
    props.exercise.id,
    props.exercise,
    props.mode,
    props.prefs.bellOnCompletion,
    props.prefs.soundEnabled,
    props.prefs.volume,
    props.onComplete,
    startedAtMs,
    typed,
    targetText,
    timeLimitMs,
  ])

  const pb = useMemo(
    () => getPersonalBest(props.exercise.id, timeLimitMs as SprintDurationMs | undefined),
    [props.exercise.id, timeLimitMs],
  )

  const bestAccuracy = useMemo(
    () => bestAccuracyForExercise(props.exercise.id, timeLimitMs as SprintDurationMs | undefined),
    [props.exercise.id, timeLimitMs],
  )

  const bestWpm = useMemo(() => {
    if (props.mode === 'competitive') return pb?.wpm ?? null
    return bestWpmForExercise(props.exercise.id)
  }, [pb?.wpm, props.exercise.id, props.mode])

  const ghostCursorIndex = useMemo(() => {
    if (!props.ghostEnabled) return null
    if (props.mode !== 'competitive') return null
    if (!pb) return null
    if (startedAtMs == null) return null

    const elapsedMinutes = elapsedForMetrics / 60_000
    const expectedChars = Math.floor(pb.wpm * 5 * elapsedMinutes)
    return Math.max(0, Math.min(targetText.length, expectedChars))
  }, [elapsedForMetrics, pb, props.ghostEnabled, props.mode, startedAtMs, targetText.length])

  const feedback = useMemo(() => {
    const durationMs = timeLimitMs ?? elapsedMs

    const isPersonalBestWpm =
      (props.mode === 'competitive' ? live.accuracy >= 0.95 : true) &&
      (bestWpm == null || live.wpm > bestWpm)

    const isPersonalBestAccuracy = bestAccuracy == null || live.accuracy > bestAccuracy

    const deltaWpmVsBest = props.mode === 'competitive' && pb != null ? live.wpm - pb.wpm : 0
    const deltaAccuracyVsBest = bestAccuracy != null ? live.accuracy - bestAccuracy : 0

    return buildFeedback({
      mode: props.mode,
      wpm: live.wpm,
      accuracy: live.accuracy,
      errors: live.errors,
      backspaces,
      duration_ms: durationMs,
      is_personal_best_wpm: isPersonalBestWpm,
      is_personal_best_accuracy: isPersonalBestAccuracy,
      delta_wpm_vs_best: deltaWpmVsBest,
      delta_accuracy_vs_best: deltaAccuracyVsBest,
    })
  }, [
    backspaces,
    bestAccuracy,
    bestWpm,
    elapsedMs,
    live.accuracy,
    live.errors,
    live.wpm,
    pb,
    props.mode,
    timeLimitMs,
  ])

  const showLiveWpm = props.prefs.showLiveWpm[props.mode]
  const minimalHud = props.mode === 'focus' ? props.prefs.focusMinimalHud : false

  const containerStyle: CSSProperties = {
    fontSize: `${props.prefs.fontScale}rem`,
  }

  const helpTextId = `typing-help-${props.exercise.id}`

  return (
    <div className="space-y-5" style={containerStyle}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-zinc-500">{props.exercise.pack}</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">{props.exercise.title}</h1>
          <div className="mt-1 text-sm text-zinc-500">
            Difficulty {props.exercise.difficulty} • Est. {props.exercise.estimated_seconds}s
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onRestart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none transition duration-150 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Icon name="refresh" size={14} className="shrink-0" />
            Restart
          </button>
          <button
            type="button"
            onClick={props.onExit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 outline-none transition duration-150 hover:bg-white focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Icon name="x-close" size={14} className="shrink-0" />
            Exit
          </button>
        </div>
      </div>

      {props.showCompetitiveHud ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Remaining" value={timeLimitMs ? formatMs(remainingMs ?? 0) : '—'} icon="timer" />
          <Stat label="WPM" value={`${Math.round(live.wpm)}`} icon="stat-speed" />
          <Stat label="Accuracy" value={`${Math.round(live.accuracy * 1000) / 10}%`} icon="stat-accuracy" />
          <Stat label="Errors" value={`${live.errors}`} icon="zap" />
        </div>
      ) : minimalHud ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Time" value={formatMs(elapsedMs)} icon="clock" />
          <Stat label="Progress" value={`${typed.length}/${targetText.length}`} icon="bar-chart" />
          <Stat label="Accuracy" value={`${Math.round(live.accuracy * 1000) / 10}%`} icon="stat-accuracy" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Time" value={formatMs(elapsedMs)} icon="clock" />
          <Stat label="WPM" value={showLiveWpm ? `${Math.round(live.wpm)}` : 'Hidden'} icon="stat-speed" />
          <Stat label="Accuracy" value={`${Math.round(live.accuracy * 1000) / 10}%`} icon="stat-accuracy" />
          <Stat label="Backspaces" value={`${backspaces}`} icon="backspace" />
        </div>
      )}

      <div className="rounded-3xl bg-zinc-900/50 p-5">
        <TypingOverlay
          target={targetText}
          typed={typed}
          showCursor={!isComplete}
          ghostIndex={!isComplete ? ghostCursorIndex : null}
        />
      </div>

      <div className="rounded-2xl bg-zinc-900/30 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-200">Type here</div>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none transition duration-150 hover:bg-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Icon name="cursor" size={12} className="shrink-0" />
            Focus
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={typed}
          aria-label="Typing input"
          aria-describedby={helpTextId}
          onFocus={() => {
            setInputFocused(true)
            typewriterAudio.ensureReady().then(() => typewriterAudio.resume())
          }}
          onBlur={() => {
            setInputFocused(false)
          }}
          onKeyDown={(e) => {
            // Escape exits the session
            if (e.key === 'Escape') {
              e.preventDefault()
              props.onExit()
              return
            }

            if (isComplete) return

            if (startedAtMs == null && (e.key.length === 1 || e.key === 'Enter')) {
              setStartedAtMs(Date.now())
            }

            // ignore modifiers
            if (e.ctrlKey || e.metaKey || e.altKey) return

            noteTypingActivity()

            const modeGain = props.mode === 'focus' ? 0.7 : props.mode === 'competitive' ? 1.0 : 0.85

            if (e.key === 'Backspace') {
              setBackspaces((v) => v + 1)
              typewriterAudio.play('backspace', {
                enabled: props.prefs.soundEnabled,
                volume: props.prefs.volume,
                modeGain,
              })
              return
            }

            if (e.key === ' ') {
              typewriterAudio.play('spacebar', {
                enabled: props.prefs.soundEnabled,
                volume: props.prefs.volume,
                modeGain,
              })
              return
            }

            if (e.key === 'Enter') {
              typewriterAudio.play('key', {
                enabled: props.prefs.soundEnabled,
                volume: props.prefs.volume,
                modeGain,
              })
              return
            }

            if (e.key.length === 1) {
              const expected = targetText[typed.length] ?? null
              if (expected != null && e.key !== expected) {
                typewriterAudio.play('error', {
                  enabled: props.prefs.soundEnabled,
                  volume: props.prefs.volume * 0.6,
                  modeGain,
                })
              } else {
                typewriterAudio.play('key', {
                  enabled: props.prefs.soundEnabled,
                  volume: props.prefs.volume,
                  modeGain,
                })
              }
            }
          }}
          onChange={(e) => {
            if (isComplete) return
            const next = e.target.value
            setTyped(next)

            if (next.length !== typed.length) noteTypingActivity()

            if (startedAtMs == null && next.length > 0) setStartedAtMs(Date.now())

            if (timeLimitMs == null && next === targetText) {
              setEndedAtMs(Date.now())
            }
          }}
          spellCheck={false}
          className="mt-4 min-h-24 w-full resize-y rounded-lg border border-zinc-700/50 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition-colors duration-200 focus:border-zinc-500/70 focus-visible:ring-2 focus-visible:ring-zinc-200/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          placeholder="Start typing…"
        />

        <div id={helpTextId} className="mt-4 text-xs leading-relaxed text-zinc-400" aria-live="polite" aria-atomic="true">
          {isComplete ? (
            <div className="space-y-2 animate-fade-in">
              <div className={`flex items-center gap-1.5 font-medium ${feedback.isNewPb ? 'text-zinc-50' : 'text-zinc-200'}`}>
                <Icon name={feedback.isNewPb ? 'personal-best' : 'checkmark-circle'} size={14} className={`shrink-0 ${feedback.isNewPb ? 'text-zinc-300' : 'text-zinc-400'}`} />
                {feedback.primary}
              </div>
              {feedback.secondary ? <div className="text-zinc-300">{feedback.secondary}</div> : null}
              {props.mode === 'competitive' && pb ? (
                <div className="flex items-center gap-1.5">
                  <Icon name="trophy" size={14} className="shrink-0 text-zinc-500" />
                  PB: <span className="text-zinc-200">{Math.round(pb.wpm)} WPM</span> at{' '}
                  <span className="text-zinc-200">{Math.round(pb.accuracy * 1000) / 10}%</span>
                  {live.accuracy >= 0.95 ? (
                    <span className="ml-2">
                      ΔWPM: <span className="text-zinc-200">{(live.wpm - pb.wpm).toFixed(1)}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="flex items-center gap-1"><Icon name="stat-speed" size={12} className="text-zinc-500" /> WPM: {Math.round(live.wpm)}</div>
                <div className="flex items-center gap-1"><Icon name="stat-accuracy" size={12} className="text-zinc-500" /> Accuracy: {Math.round(live.accuracy * 1000) / 10}%</div>
                <div className="flex items-center gap-1"><Icon name="zap" size={12} className="text-zinc-500" /> Errors: {live.errors}</div>
                <div className="flex items-center gap-1"><Icon name="backspace" size={12} className="text-zinc-500" /> Backspaces: {backspaces}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Icon name="keyboard" size={14} className="shrink-0 text-zinc-500" />
              All characters supported. Backspace allowed (counted). Esc to exit.
            </div>
          )}
        </div>
      </div>

      {props.mode === 'competitive' ? (
        <div className="flex items-center gap-2 rounded-2xl bg-zinc-900/30 p-5 text-xs text-zinc-400">
          <Icon name="info" size={14} className="shrink-0 text-zinc-500" />
          Personal bests require ≥ 95% accuracy.
        </div>
      ) : null}
    </div>
  )
}
