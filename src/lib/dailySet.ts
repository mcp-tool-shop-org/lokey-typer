import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'
import type { UserSkillModel } from './storage'

function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(items: T[], weight: (x: T) => number, rand: () => number): T | null {
  let total = 0
  const weights = items.map((i) => {
    const w = Math.max(0, weight(i))
    total += w
    return w
  })
  if (total <= 0) return null
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1] ?? null
}

export type DailySessionType = 'reset' | 'mix' | 'deep'

export type DailySetItemKind = 'confidence' | 'targeted' | 'challenge' | 'real_life' | 'mix'

export type DailySetItem = {
  kind: DailySetItemKind
  mode: Mode
  exerciseId: string
}

export type DailySet = {
  dateKey: string
  userId: string
  sessionType: DailySessionType
  items: DailySetItem[]
}

export type DailyItemResult = {
  wpm: number
  accuracy: number
  durationMs: number
  completedAt: number
}

export type DailyProgress = {
  dateKey: string
  userId: string
  sessionType: DailySessionType
  completedItems: DailyItemResult[]
  startedAt: number
  finishedAt?: number
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function itemCount(sessionType: DailySessionType) {
  if (sessionType === 'reset') return 5
  if (sessionType === 'mix') return 8
  return 10
}

const DAILY_SET_CACHE_PREFIX = 'lkt_daily_set_v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function getCachedDailySet(params: { userId: string; dateKey: string; sessionType: DailySessionType }): DailySet | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const key = `${DAILY_SET_CACHE_PREFIX}|${params.userId}|${params.dateKey}|${params.sessionType}`
    const parsed = safeParse<DailySet>(localStorage.getItem(key))
    if (!parsed) return null
    if (parsed.userId !== params.userId) return null
    if (parsed.dateKey !== params.dateKey) return null
    if (parsed.sessionType !== params.sessionType) return null
    if (!Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

function setCachedDailySet(set: DailySet) {
  try {
    if (typeof localStorage === 'undefined') return
    const key = `${DAILY_SET_CACHE_PREFIX}|${set.userId}|${set.dateKey}|${set.sessionType}`
    localStorage.setItem(key, JSON.stringify(set))
  } catch {
    // ignore
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function bandCenterFromSkill(skill: Pick<UserSkillModel, 'total_runs' | 'ema'> | null | undefined): number {
  if (!skill || !Number.isFinite(skill.total_runs)) return 3
  if (skill.total_runs < 5) return 2.5

  const wpm = Number(skill.ema?.wpm ?? 0)
  if (!Number.isFinite(wpm)) return 3
  if (wpm < 30) return 2
  if (wpm < 45) return 2.5
  if (wpm < 60) return 3
  if (wpm < 75) return 3.5
  return 4
}

function difficultyBandWeight(difficulty: number, center: number) {
  const dist = Math.abs(difficulty - center)
  return 1 + clamp(1.5 - dist, 0, 1.5)
}

function exerciseWeight(params: {
  ex: Exercise
  kind: DailySetItemKind
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
}): number {
  const { ex, kind, weakTags, bandCenter, targetTag } = params
  let w = 1

  if (kind === 'confidence') {
    // Prefer easier items.
    w *= (6 - ex.difficulty)
    w *= difficultyBandWeight(ex.difficulty, Math.min(3, bandCenter))
  } else if (kind === 'targeted') {
    // Keep within band but bias toward weakness tag.
    w *= difficultyBandWeight(ex.difficulty, bandCenter)
  } else if (kind === 'challenge') {
    // Prefer harder items.
    w *= ex.difficulty
    w *= difficultyBandWeight(ex.difficulty, Math.max(3, bandCenter + 1))
  } else {
    // Default: stay near the user’s current band.
    w *= difficultyBandWeight(ex.difficulty, bandCenter)
  }

  const tagHits = weakTags.reduce((acc, t) => (ex.tags.includes(t) ? acc + 1 : acc), 0)
  if (tagHits > 0) w *= 1 + tagHits * 0.75

  if (kind === 'targeted' && targetTag && ex.tags.includes(targetTag)) w *= 2.0

  // Small bias toward templates in the daily loop for replayability.
  if (ex.type === 'template') w *= 1.15

  return w
}

function pickExercise(params: {
  mode: Mode
  kind: DailySetItemKind
  rand: () => number
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
  excludeIds: Set<string>
}): Exercise | null {
  const pool = loadExercisesByMode(params.mode).filter((ex) => !params.excludeIds.has(ex.id))
  if (pool.length === 0) return null
  const picked = pickWeighted(
    pool,
    (ex) =>
      exerciseWeight({
        ex,
        kind: params.kind,
        weakTags: params.weakTags,
        bandCenter: params.bandCenter,
        targetTag: params.targetTag,
      }),
    params.rand,
  )
  return picked
}

function pickWithRelaxation(params: {
  mode: Mode
  kind: DailySetItemKind
  rand: () => number
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
  used: Set<string>
  avoid: Set<string>
}): Exercise | null {
  const strict = new Set<string>([...params.used, ...params.avoid])
  return (
    pickExercise({
      mode: params.mode,
      kind: params.kind,
      rand: params.rand,
      weakTags: params.weakTags,
      bandCenter: params.bandCenter,
      targetTag: params.targetTag,
      excludeIds: strict,
    }) ??
    pickExercise({
      mode: params.mode,
      kind: params.kind,
      rand: params.rand,
      weakTags: params.weakTags,
      bandCenter: params.bandCenter,
      targetTag: params.targetTag,
      excludeIds: params.used,
    })
  )
}

export function generateDailySet(params: {
  userId: string
  dateKey?: string
  sessionType: DailySessionType
  weakTags?: string[]
  skill?: Pick<UserSkillModel, 'total_runs' | 'ema' | 'recent_exercise_ids_by_mode'>
}): DailySet {
  const dateKey = params.dateKey ?? todayKey()

  const cached = getCachedDailySet({ userId: params.userId, dateKey, sessionType: params.sessionType })
  if (cached) return cached

  const seedStr = `${params.userId}|${dateKey}|${params.sessionType}`
  const rand = mulberry32(xmur3(seedStr)())

  const weakTags = params.weakTags ?? []
  const bandCenter = bandCenterFromSkill(params.skill)
  const targetTag = weakTags.length > 0 ? weakTags[Math.floor(rand() * weakTags.length)] ?? null : null
  const count = itemCount(params.sessionType)

  const used = new Set<string>()
  const avoid = new Set<string>()
  const novelty = params.skill?.recent_exercise_ids_by_mode
  if (novelty) {
    for (const id of novelty.focus?.slice(0, 20) ?? []) avoid.add(id)
    for (const id of novelty.real_life?.slice(0, 20) ?? []) avoid.add(id)
    for (const id of novelty.competitive?.slice(0, 20) ?? []) avoid.add(id)
  }

  const items: DailySetItem[] = []

  const confidence = pickWithRelaxation({
    mode: 'focus',
    kind: 'confidence',
    rand,
    weakTags,
    bandCenter,
    targetTag,
    used,
    avoid,
  })
  if (confidence) {
    used.add(confidence.id)
    items.push({ kind: 'confidence', mode: 'focus', exerciseId: confidence.id })
  }

  const scenario = pickWithRelaxation({
    mode: 'real_life',
    kind: 'real_life',
    rand,
    weakTags,
    bandCenter,
    targetTag,
    used,
    avoid,
  })
  if (scenario) {
    used.add(scenario.id)
    items.push({ kind: 'real_life', mode: 'real_life', exerciseId: scenario.id })
  }

  if (targetTag) {
    const targetMode: Mode = rand() < 0.6 ? 'focus' : 'real_life'
    const targeted = pickWithRelaxation({
      mode: targetMode,
      kind: 'targeted',
      rand,
      weakTags,
      bandCenter,
      targetTag,
      used,
      avoid,
    })
    if (targeted) {
      used.add(targeted.id)
      items.push({ kind: 'targeted', mode: targetMode, exerciseId: targeted.id })
    }
  }

  if (params.sessionType !== 'reset') {
    const challenge = pickWithRelaxation({
      mode: 'competitive',
      kind: 'challenge',
      rand,
      weakTags,
      bandCenter,
      targetTag,
      used,
      avoid,
    })
    if (challenge) {
      used.add(challenge.id)
      items.push({ kind: 'challenge', mode: 'competitive', exerciseId: challenge.id })
    }
  }

  while (items.length < count) {
    const mode: Mode = rand() < 0.55 ? 'focus' : 'real_life'
    const ex = pickWithRelaxation({
      mode,
      kind: 'mix',
      rand,
      weakTags,
      bandCenter,
      targetTag,
      used,
      avoid,
    })
    if (!ex) break
    used.add(ex.id)
    items.push({ kind: 'mix', mode, exerciseId: ex.id })
  }

  // Deterministic fallback if pools were unexpectedly empty.
  if (items.length === 0) {
    const pool = loadExercisesByMode('focus')
    const first = pool[0]
    if (first) items.push({ kind: 'mix', mode: 'focus', exerciseId: first.id })
  }

  const out: DailySet = {
    dateKey,
    userId: params.userId,
    sessionType: params.sessionType,
    items,
  }

  setCachedDailySet(out)
  return out
}

// --- Daily progress persistence ---

const DAILY_PROGRESS_KEY = 'lkt_daily_progress'

export function loadDailyProgress(dateKey: string, userId: string): DailyProgress | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(DAILY_PROGRESS_KEY)
    const parsed = safeParse<DailyProgress>(raw)
    if (!parsed || parsed.dateKey !== dateKey || parsed.userId !== userId) return null
    if (!Array.isArray(parsed.completedItems)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDailyProgress(progress: DailyProgress): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // ignore
  }
}
