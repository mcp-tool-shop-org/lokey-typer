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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export type RecommendationContext = {
  mode: Mode
  count?: number
  seed?: string
  skill?: Pick<
    UserSkillModel,
    'ema' | 'total_runs' | 'weak_tags' | 'weakness_by_tag' | 'by_mode' | 'recent_exercise_ids_by_mode'
  >
}

export type Recommendation = {
  exerciseId: string
  reasonTags: string[]
  reasonText: string
}

export type RecommendationPrefs = {
  screenReaderMode: boolean
}

function bandCenterFromSkill(skill: RecommendationContext['skill'], mode: Mode): number {
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

function isSrSafe(ex: Exercise): boolean {
  if (ex.tags.includes('multiline')) return false
  if (ex.estimated_seconds > 60) return false
  return true
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

export function getNextRecommendations(
  ctx: RecommendationContext,
  prefs: RecommendationPrefs,
): Recommendation[] {
  const count = Math.max(1, Math.min(8, Math.floor(ctx.count ?? 5)))
  const seedStr = ctx.seed ?? `${ctx.mode}|${new Date().toISOString().slice(0, 10)}`
  const rand = mulberry32(xmur3(seedStr)())

  const poolBase = loadExercisesByMode(ctx.mode)
  const recent = new Set(ctx.skill?.recent_exercise_ids_by_mode?.[ctx.mode]?.slice(0, 30) ?? [])

  const pool = poolBase
    .filter((ex) => !recent.has(ex.id))
    .filter((ex) => (prefs.screenReaderMode ? isSrSafe(ex) : true))

  const bandCenter = bandCenterFromSkill(ctx.skill, ctx.mode)
  const weakTags = ctx.skill?.weak_tags ?? []
  const weakness = ctx.skill?.weakness_by_tag ?? {}

  const used = new Set<string>()
  const out: Recommendation[] = []

  function weight(ex: Exercise): number {
    let w = 1
    w *= difficultyBandWeight(ex.difficulty, bandCenter)

    // Tag targeting (weakness-weighted).
    for (const t of ex.tags) {
      const s = weakness[t]
      if (Number.isFinite(s) && s > 0) w *= 1 + clamp(s, 0, 1) * 0.75
    }

    // Small bias toward exercises that match any known weak tag.
    const hits = weakTags.reduce((acc, t) => (ex.tags.includes(t) ? acc + 1 : acc), 0)
    if (hits > 0) w *= 1 + hits * 0.4

    // Prefer templates slightly for replayability.
    if (ex.type === 'template') w *= 1.1

    return w
  }

  while (out.length < count) {
    const candidates = pool.filter((ex) => !used.has(ex.id))
    if (candidates.length === 0) break

    const picked = pickWeighted(candidates, weight, rand)
    if (!picked) break

    used.add(picked.id)

    const reasonTags = weakTags.filter((t) => picked.tags.includes(t)).slice(0, 3)
    const reasonText =
      reasonTags.length > 0
        ? `Targets: ${reasonTags.join(', ')} (and stays near your current band).`
        : 'Stays near your current band with variety.'

    out.push({ exerciseId: picked.id, reasonTags, reasonText })
  }

  return out
}
