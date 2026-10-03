import type { Exercise, Mode } from '@content'
import type { RunResult, UserSkillModel } from './storage'

export type CharClass =
  | 'letters'
  | 'numbers'
  | 'space'
  | 'newline'
  | 'apostrophe'
  | 'quotes'
  | 'dash'
  | 'punctuation'
  | 'brackets'
  | 'slash'
  | 'symbol'
  | 'overflow'

export type LengthBucket = 'short' | 'medium' | 'long' | 'multiline'

function isLetter(ch: string) {
  return /^[A-Za-z]$/.test(ch)
}

function isNumber(ch: string) {
  return /^[0-9]$/.test(ch)
}

function charClassForExpected(expected: string | null): CharClass {
  if (expected == null) return 'overflow'
  if (expected === '\n') return 'newline'
  if (expected === ' ') return 'space'

  if (expected === "'" || expected === '’') return 'apostrophe'
  if (expected === '"' || expected === '“' || expected === '”') return 'quotes'
  if (expected === '-' || expected === '–' || expected === '—') return 'dash'

  if ('()[]{}<>'.includes(expected)) return 'brackets'
  if (expected === '/' || expected === '\\') return 'slash'
  if (isNumber(expected)) return 'numbers'
  if (isLetter(expected)) return 'letters'
  if (',.;:?!'.includes(expected)) return 'punctuation'
  if (/^[^\w\s]$/.test(expected)) return 'symbol'
  return 'symbol'
}

export type MistakeCounts = Partial<Record<CharClass, number>>

const CHAR_CLASSES: readonly CharClass[] = [
  'letters',
  'numbers',
  'space',
  'newline',
  'apostrophe',
  'quotes',
  'dash',
  'punctuation',
  'brackets',
  'slash',
  'symbol',
  'overflow',
]

// tags_hit names are not the char-class names: dashes, multiline, slashes.
const TAG_TO_CLASS: Readonly<Record<string, CharClass | undefined>> = {
  apostrophe: 'apostrophe',
  quotes: 'quotes',
  dashes: 'dash',
  punctuation: 'punctuation',
  multiline: 'newline',
  brackets: 'brackets',
  slashes: 'slash',
  numbers: 'numbers',
}

export function noteMistake(counts: MistakeCounts, expected: string | null): MistakeCounts {
  const cls = charClassForExpected(expected)
  counts[cls] = (counts[cls] ?? 0) + 1
  return counts
}

function mistakeCount(counts: MistakeCounts, cls: CharClass): number {
  const n = counts[cls]
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

function countCharsByClass(text: string): Partial<Record<CharClass, number>> {
  const counts: Partial<Record<CharClass, number>> = {}
  for (let i = 0; i < text.length; i++) {
    const cls = charClassForExpected(text[i] ?? null)
    counts[cls] = (counts[cls] ?? 0) + 1
  }
  return counts
}

function bucketForExercise(ex: Exercise, targetText: string): LengthBucket {
  const isMultiline =
    (ex.type === 'template' ? ex.template.includes('\n') : false) || targetText.includes('\n')
  if (isMultiline) return 'multiline'

  const s = ex.estimated_seconds
  if (s <= 30) return 'short'
  if (s <= 90) return 'medium'
  return 'long'
}

function emaUpdate(prev: number, next: number, alpha: number) {
  if (!Number.isFinite(prev)) return next
  return prev + alpha * (next - prev)
}

export function computeErrorHotspots(params: {
  target: string
  typed: string
}): Record<CharClass, number> {
  const out: Record<CharClass, number> = {
    letters: 0,
    numbers: 0,
    space: 0,
    newline: 0,
    apostrophe: 0,
    quotes: 0,
    dash: 0,
    punctuation: 0,
    brackets: 0,
    slash: 0,
    symbol: 0,
    overflow: 0,
  }

  const max = Math.max(params.target.length, params.typed.length)
  for (let i = 0; i < max; i++) {
    const expected = i < params.target.length ? params.target[i] : null
    const actual = i < params.typed.length ? params.typed[i] : null
    if (actual == null) continue
    if (expected != null && actual === expected) continue
    const cls = charClassForExpected(expected)
    out[cls]++
  }

  return out
}

function deriveWeakTagsFromScores(scores: Record<string, number>): string[] {
  return Object.entries(scores)
    .filter(([, v]) => Number.isFinite(v) && v > 0.001)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k)
}

function updateRecentIds(params: { prev: string[] | undefined; nextId: string; max: number }): string[] {
  const prev = Array.isArray(params.prev) ? params.prev : []
  return [params.nextId, ...prev.filter((id) => id !== params.nextId)].slice(0, params.max)
}

function updateByModeStats(params: {
  prev: UserSkillModel['by_mode']
  mode: Mode
  wpm: number
  accuracy: number
  backspaceRate: number
  alpha: number
}): UserSkillModel['by_mode'] {
  const next = { ...params.prev }
  const prevBucket = next[params.mode] ?? { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 }
  next[params.mode] = {
    ema_wpm: emaUpdate(prevBucket.ema_wpm, params.wpm, params.alpha),
    ema_accuracy: emaUpdate(prevBucket.ema_accuracy, params.accuracy, params.alpha),
    ema_backspace_rate: emaUpdate(prevBucket.ema_backspace_rate, params.backspaceRate, params.alpha),
    runs: (prevBucket.runs ?? 0) + 1,
  }
  return next
}

export function updateSkillModelFromRun(params: {
  prev: UserSkillModel
  run: RunResult
  exercise: Exercise
  targetText: string
  typedText: string
  mistakes: MistakeCounts
}): UserSkillModel {
  const alpha = 0.2
  const now = new Date().toISOString()

  const typedLen = Math.max(1, params.typedText.length)
  const backspaceRate = Math.max(0, Math.min(1, params.run.backspaces / typedLen))

  const bucket = bucketForExercise(params.exercise, params.targetText)
  const opportunities = countCharsByClass(params.targetText)

  const nextErrorsByClass: Record<string, number> = { ...(params.prev.errors_by_class ?? {}) }
  for (const cls of CHAR_CLASSES) {
    const seen = (opportunities[cls] ?? 0) > 0
    const mistakes = mistakeCount(params.mistakes, cls)
    if (!seen && mistakes === 0) continue
    const prevVal = nextErrorsByClass[cls] ?? 0
    nextErrorsByClass[cls] = emaUpdate(prevVal, mistakes, alpha)
  }

  const tagsHit = (params.run.tags_hit ?? []).filter((t) => typeof t === 'string')
  const nextWeaknessByTag: Record<string, number> = { ...(params.prev.weakness_by_tag ?? {}) }
  for (const tag of tagsHit) {
    const cls = TAG_TO_CLASS[tag]
    if (cls == null) continue
    const seen = opportunities[cls] ?? 0
    const rate = seen === 0 ? 0 : Math.max(0, Math.min(1, mistakeCount(params.mistakes, cls) / seen))
    const prevScore = nextWeaknessByTag[tag] ?? 0
    nextWeaknessByTag[tag] = emaUpdate(prevScore, rate, alpha)
  }

  const derivedWeakTags = deriveWeakTagsFromScores(nextWeaknessByTag)

  const nextPerf = { ...params.prev.performance_by_length }
  const prevBucket = nextPerf[bucket]
  nextPerf[bucket] = {
    ema_wpm: emaUpdate(prevBucket.ema_wpm, params.run.wpm, alpha),
    ema_accuracy: emaUpdate(prevBucket.ema_accuracy, params.run.accuracy, alpha),
    ema_backspace_rate: emaUpdate(prevBucket.ema_backspace_rate, backspaceRate, alpha),
    runs: (prevBucket.runs ?? 0) + 1,
  }

  const next: UserSkillModel = {
    ...params.prev,
    version: 2,
    updated_at: now,
    total_runs: (params.prev.total_runs ?? 0) + 1,
    ema: {
      wpm: emaUpdate(params.prev.ema?.wpm ?? 0, params.run.wpm, alpha),
      accuracy: emaUpdate(params.prev.ema?.accuracy ?? 1, params.run.accuracy, alpha),
      backspace_rate: emaUpdate(params.prev.ema?.backspace_rate ?? 0, backspaceRate, alpha),
    },
    by_mode: updateByModeStats({
      prev:
        params.prev.by_mode ??
        ({
          focus: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
          real_life: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
          competitive: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
        } as UserSkillModel['by_mode']),
      mode: params.run.mode,
      wpm: params.run.wpm,
      accuracy: params.run.accuracy,
      backspaceRate,
      alpha,
    }),
    errors_by_class: nextErrorsByClass,
    performance_by_length: nextPerf,
    weakness_by_tag: nextWeaknessByTag,
    weak_tags: derivedWeakTags,
    recent_exercise_ids_by_mode: {
      ...(params.prev.recent_exercise_ids_by_mode ?? { focus: [], real_life: [], competitive: [] }),
      [params.run.mode]: updateRecentIds({
        prev: params.prev.recent_exercise_ids_by_mode?.[params.run.mode],
        nextId: params.run.exercise_id,
        max: 50,
      }),
    },
  }

  return next
}
