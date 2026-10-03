import type { Exercise, ExerciseTemplate } from '@content'

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

export function isTemplateExercise(ex: Exercise): ex is ExerciseTemplate {
  return (ex as { type?: unknown }).type === 'template'
}

export function renderTemplateExercise(
  ex: ExerciseTemplate,
  opts?: {
    dateKey?: string
    seed?: string
  },
) {
  const today = new Date().toISOString().slice(0, 10)
  const dateKey = opts?.dateKey ?? today
  const seedStr = opts?.seed ?? `${ex.id}|${dateKey}`
  const seed = xmur3(seedStr)()
  const rand = mulberry32(seed)

  const chosen = new Map<string, string>()

  const out = ex.template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_full, slotName: string) => {
    if (chosen.has(slotName)) return chosen.get(slotName) ?? slotName
    const values = ex.slots?.[slotName]
    if (!Array.isArray(values) || values.length === 0) return slotName
    const cleaned = values.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0)
    if (cleaned.length === 0) return slotName
    const idx = Math.floor(rand() * cleaned.length)
    const val = cleaned[Math.min(cleaned.length - 1, Math.max(0, idx))] ?? slotName
    chosen.set(slotName, val)
    return val
  })

  // Final guard: never allow unresolved tokens to reach the UI.
  return out.replace(/\{[a-zA-Z0-9_]+\}/g, (m) => m.slice(1, -1))
}
