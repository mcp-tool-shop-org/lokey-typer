import type { Exercise, Mode } from '@content'
import { loadExercisesByMode } from '@content'
import { isTemplateExercise, renderTemplateExercise } from './templateRender'
import { loadRecents, type Preferences, type UserSkillModel } from './storage'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContentEngineResult = {
  exercise: Exercise
  renderedText: string
  seed: string
}

export type PoolStatus = {
  total: number
  seen: number
  remaining: number
}

// ---------------------------------------------------------------------------
// PRNG helpers (inlined from recommendations.ts — small pure functions)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Weighting helpers (inlined from recommendations.ts)
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function bandCenterFromSkill(skill: UserSkillModel | null, mode: Mode): number {
  if (!skill || !Number.isFinite(skill.total_runs)) return 3
  if (skill.total_runs < 5) return 2.5

  const wpm = Number(skill.by_mode?.[mode]?.ema_wpm ?? skill.ema?.wpm ?? 0)
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

// ---------------------------------------------------------------------------
// Text resolution
// ---------------------------------------------------------------------------

function repeatToLength(base: string, minLen: number) {
  let out = base
  while (out.length < minLen) out += `\n\n${base}`
  return out
}

function resolveText(exercise: Exercise, userId: string, mode: Mode): { text: string; seed: string } {
  const seed = `${userId}|${exercise.id}|${Date.now()}`

  let text: string
  if (isTemplateExercise(exercise)) {
    text = renderTemplateExercise(exercise, { seed })
  } else {
    text = exercise.text_short ?? exercise.text ?? exercise.text_long ?? ''
  }

  // Competitive mode: ensure enough text for sprint
  if (mode === 'competitive') {
    text = repeatToLength(text, 1800)
  }

  return { text, seed }
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function pickNextExercise(params: {
  mode: Mode
  userId: string
  skill: UserSkillModel | null
  prefs: Preferences
}): ContentEngineResult {
  const { mode, userId, skill, prefs } = params
  const allExercises = loadExercisesByMode(mode)

  if (allExercises.length === 0) {
    throw new Error(`No exercises available for mode: ${mode}`)
  }

  const recents = loadRecents().byMode[mode] ?? []
  const recentSet = new Set(recents)

  // Partition into unseen and seen
  const unseen = allExercises.filter((ex) => !recentSet.has(ex.id))
  const pool = unseen.length > 0 ? unseen : allExercises

  // Build the rand function
  const seedStr = `${userId}|${mode}|${Date.now()}`
  const rand = mulberry32(xmur3(seedStr)())

  // Weighting
  const bandCenter = bandCenterFromSkill(skill, mode)
  const weakTags = skill?.weak_tags ?? []
  const weakness = skill?.weakness_by_tag ?? {}

  // Screen reader safety filter
  const srSafe = prefs.screenReaderMode
  const candidates = srSafe
    ? pool.filter((ex) => !ex.tags.includes('multiline') && ex.estimated_seconds <= 60)
    : pool

  // If screen reader filtered everything, fall back to full pool
  const finalPool = candidates.length > 0 ? candidates : pool

  function weight(ex: Exercise): number {
    let w = 1

    // Difficulty band
    w *= difficultyBandWeight(ex.difficulty, bandCenter)

    // Weakness targeting
    for (const t of ex.tags) {
      const s = weakness[t]
      if (Number.isFinite(s) && s > 0) w *= 1 + clamp(s, 0, 1) * 0.75
    }

    // Weak tag boost
    const hits = weakTags.reduce((acc: number, t: string) => (ex.tags.includes(t) ? acc + 1 : acc), 0)
    if (hits > 0) w *= 1 + hits * 0.4

    // Template preference (replayable = always fresh)
    if (ex.type === 'template') w *= 1.15

    // If we're in the "seen pool" fallback, deprioritize most-recently-played
    if (unseen.length === 0 && recentSet.has(ex.id)) {
      const idx = recents.indexOf(ex.id)
      if (idx >= 0) {
        // Exponential decay: most recent (idx=0) gets lowest weight
        w *= 0.1 + 0.9 * (idx / Math.max(1, recents.length - 1))
      }
    }

    return w
  }

  const picked = pickWeighted(finalPool, weight, rand)
  const exercise = picked ?? finalPool[0]

  const { text, seed } = resolveText(exercise, userId, mode)

  return { exercise, renderedText: text, seed }
}

// ---------------------------------------------------------------------------
// Pool status
// ---------------------------------------------------------------------------

export function getPoolStatus(mode: Mode): PoolStatus {
  const total = loadExercisesByMode(mode).length
  const recents = loadRecents().byMode[mode] ?? []
  const seen = Math.min(recents.length, total)
  return { total, seen, remaining: total - seen }
}
