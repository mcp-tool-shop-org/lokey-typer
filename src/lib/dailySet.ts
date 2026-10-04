import { findExercise, loadExercisesByMode, type Exercise, type Mode } from '@content'
import { passageKey } from '@content/catalog'
import { isScreenReaderSafePassage, tagMatches } from './passageShape'
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
  exerciseId?: string
  skipped?: boolean
}

export type DailyProgress = {
  dateKey: string
  userId: string
  sessionType: DailySessionType
  completedItems: DailyItemResult[]
  startedAt: number
  finishedAt?: number
}

export function localDateKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayKey() {
  return localDateKey()
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

function dailyCacheKey(params: {
  userId: string
  dateKey: string
  sessionType: DailySessionType
  screenReaderMode: boolean
}): string {
  const base = `${DAILY_SET_CACHE_PREFIX}|${params.userId}|${params.dateKey}|${params.sessionType}`
  return params.screenReaderMode ? `${base}|sr` : base
}

function getCachedDailySet(params: {
  userId: string
  dateKey: string
  sessionType: DailySessionType
  screenReaderMode: boolean
}): DailySet | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const key = dailyCacheKey(params)
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

function cachedDailySetUsable(set: DailySet, screenReaderMode: boolean): boolean {
  if (!screenReaderMode) return true
  return (
    set.items.length > 0 &&
    set.items.every((item) => {
      const exercise = findExercise(item.exerciseId)
      return exercise != null && isScreenReaderSafePassage(exercise)
    })
  )
}

/** Tagged results count only for their exercise. A rebuilt set does not inherit another passage. */
export function dailyResumeIndex(items: DailySetItem[], results: DailyItemResult[]): number {
  if (results.length === 0) return 0
  const tagged = results.every((result) => typeof result.exerciseId === 'string' && result.exerciseId.length > 0)
  if (!tagged) return results.length
  const done = new Set(results.map((result) => result.exerciseId))
  let index = 0
  while (index < items.length && done.has(items[index]?.exerciseId)) index += 1
  return index
}

function dailySetDate(key: string): string | null {
  if (!key.startsWith(`${DAILY_SET_CACHE_PREFIX}|`)) return null
  const dateKey = key.split('|')[2] ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null
}

function pruneStaleDailySetCache(activeDate: string) {
  try {
    if (typeof localStorage === 'undefined') return
    const keep = new Set([todayKey(), activeDate])
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(`${DAILY_SET_CACHE_PREFIX}|`)) continue
      const dateKey = dailySetDate(key)
      if (dateKey == null || !keep.has(dateKey)) stale.push(key)
    }
    for (const key of stale) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function setCachedDailySet(set: DailySet, screenReaderMode: boolean) {
  try {
    if (typeof localStorage === 'undefined') return
    const key = dailyCacheKey({
      userId: set.userId,
      dateKey: set.dateKey,
      sessionType: set.sessionType,
      screenReaderMode,
    })
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

  const tagHits = weakTags.reduce((acc, t) => (tagMatches(ex.tags, t) ? acc + 1 : acc), 0)
  if (tagHits > 0) w *= 1 + tagHits * 0.75

  if (kind === 'targeted' && targetTag && tagMatches(ex.tags, targetTag)) w *= 2.0

  // Small bias toward templates in the daily loop for replayability.
  if (ex.type === 'template') w *= 1.15

  return w
}

function rememberRecentPassage(ids: readonly string[] | undefined, avoid: Set<string>) {
  for (const id of ids?.slice(0, 20) ?? []) {
    const found = findExercise(id)
    avoid.add(found ? passageKey(found) : id)
  }
}

function pickExercise(params: {
  mode: Mode
  kind: DailySetItemKind
  rand: () => number
  weakTags: string[]
  bandCenter: number
  targetTag: string | null
  excludeIds: Set<string>
  screenReaderMode: boolean
}): Exercise | null {
  const pool = loadExercisesByMode(params.mode).filter((ex) => {
    if (params.excludeIds.has(ex.id) || params.excludeIds.has(passageKey(ex))) return false
    if (params.screenReaderMode && !isScreenReaderSafePassage(ex)) return false
    return true
  })
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
  screenReaderMode: boolean
}): Exercise | null {
  const strict = new Set<string>([...params.used, ...params.avoid])
  const shared = {
    mode: params.mode,
    kind: params.kind,
    rand: params.rand,
    weakTags: params.weakTags,
    bandCenter: params.bandCenter,
    targetTag: params.targetTag,
    screenReaderMode: params.screenReaderMode,
  }
  return (
    pickExercise({ ...shared, excludeIds: strict }) ??
    pickExercise({ ...shared, excludeIds: params.used })
  )
}

export function generateDailySet(params: {
  userId: string
  dateKey?: string
  sessionType: DailySessionType
  weakTags?: string[]
  skill?: Pick<UserSkillModel, 'total_runs' | 'ema' | 'recent_exercise_ids_by_mode'>
  screenReaderMode?: boolean
}): DailySet {
  const dateKey = params.dateKey ?? todayKey()
  const screenReaderMode = Boolean(params.screenReaderMode)
  pruneStaleDailySetCache(dateKey)

  const cached = getCachedDailySet({
    userId: params.userId,
    dateKey,
    sessionType: params.sessionType,
    screenReaderMode,
  })
  if (cached && cachedDailySetUsable(cached, screenReaderMode)) return cached

  const seedStr = screenReaderMode
    ? `${params.userId}|${dateKey}|${params.sessionType}|sr`
    : `${params.userId}|${dateKey}|${params.sessionType}`
  const rand = mulberry32(xmur3(seedStr)())

  const weakTags = params.weakTags ?? []
  const bandCenter = bandCenterFromSkill(params.skill)
  const targetTag = weakTags.length > 0 ? weakTags[Math.floor(rand() * weakTags.length)] ?? null : null
  const count = itemCount(params.sessionType)

  const used = new Set<string>()
  const avoid = new Set<string>()
  const novelty = params.skill?.recent_exercise_ids_by_mode
  if (novelty) {
    rememberRecentPassage(novelty.focus, avoid)
    rememberRecentPassage(novelty.real_life, avoid)
    rememberRecentPassage(novelty.competitive, avoid)
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
    screenReaderMode,
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
    screenReaderMode,
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
      screenReaderMode,
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
      screenReaderMode,
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
      screenReaderMode,
    })
    if (!ex) break
    used.add(ex.id)
    items.push({ kind: 'mix', mode, exerciseId: ex.id })
  }

  // Deterministic fallback if pools were unexpectedly empty.
  if (items.length === 0) {
    const pool = loadExercisesByMode('focus').filter((ex) =>
      screenReaderMode ? isScreenReaderSafePassage(ex) : true,
    )
    const first = pool[0]
    if (first) items.push({ kind: 'mix', mode: 'focus', exerciseId: first.id })
  }

  const out: DailySet = {
    dateKey,
    userId: params.userId,
    sessionType: params.sessionType,
    items,
  }

  setCachedDailySet(out, screenReaderMode)
  return out
}

// --- Daily progress persistence ---

const DAILY_PROGRESS_PREFIX = 'lkt_daily_progress_v1'
const LEGACY_DAILY_PROGRESS_KEY = 'lkt_daily_progress'

function dailyProgressKey(
  userId: string,
  dateKey: string,
  sessionType: DailySessionType,
  screenReaderMode: boolean,
): string {
  const base = `${DAILY_PROGRESS_PREFIX}|${userId}|${dateKey}|${sessionType}`
  return screenReaderMode ? `${base}|sr` : base
}

function progressMatches(
  progress: DailyProgress,
  dateKey: string,
  userId: string,
  sessionType: DailySessionType,
): boolean {
  return progress.dateKey === dateKey && progress.userId === userId && progress.sessionType === sessionType
}

function readDailyProgress(raw: string | null): DailyProgress | null {
  const parsed = safeParse<DailyProgress>(raw)
  if (!parsed || !Array.isArray(parsed.completedItems)) return null
  return parsed
}

export function loadDailyProgress(
  dateKey: string,
  userId: string,
  sessionType: DailySessionType,
  screenReaderMode: boolean,
): DailyProgress | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const key = dailyProgressKey(userId, dateKey, sessionType, screenReaderMode)
    const raw = localStorage.getItem(key)
    if (raw != null) {
      const current = readDailyProgress(raw)
      if (current && progressMatches(current, dateKey, userId, sessionType)) return current
      return null
    }

    const legacyRaw = localStorage.getItem(LEGACY_DAILY_PROGRESS_KEY)
    if (legacyRaw == null) return null
    const legacy = readDailyProgress(legacyRaw)
    if (!legacy || !progressMatches(legacy, dateKey, userId, sessionType)) return null
    // Screen reader progress is its own ritual. Do not copy the plain blob onto it, and do not delete it.
    if (screenReaderMode) return null
    localStorage.setItem(key, legacyRaw)
    localStorage.removeItem(LEGACY_DAILY_PROGRESS_KEY)
    return legacy
  } catch {
    return null
  }
}

export function saveDailyProgress(progress: DailyProgress, screenReaderMode: boolean): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const key = dailyProgressKey(progress.userId, progress.dateKey, progress.sessionType, screenReaderMode)
    localStorage.setItem(key, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}
