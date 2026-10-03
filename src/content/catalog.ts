import type { Exercise } from './types'

/** Collapse whitespace so two copies of the same passage compare equal. Case stays, because it is part of the typing. */
export function normalizePassageText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function passageKey(ex: Exercise): string {
  if (ex.type === 'template') {
    const slots = Object.keys(ex.slots)
      .sort()
      .map((name) => {
        const values = [...ex.slots[name]].map((value) => value.trim()).filter((value) => value.length > 0).sort()
        return `${name}=${values.join('\u0001')}`
      })
    return `t\u0000${ex.mode}\u0000${normalizePassageText(ex.template)}\u0000${slots.join('\u0002')}`
  }

  const short = normalizePassageText(ex.text_short ?? ex.text ?? '')
  const long = normalizePassageText(ex.text_long ?? ex.text ?? short)
  return `p\u0000${ex.mode}\u0000${short}\u0000${long}`
}

/**
 * Difficulty stamped on copies of one passage.
 * Even counts use the lower of the two middle values, so a split does not round up.
 */
export function lowerMedianDifficulty(values: readonly number[]): Exercise['difficulty'] {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const pick = sorted[Math.floor((sorted.length - 1) / 2)] ?? 1
  if (pick <= 1) return 1
  if (pick >= 5) return 5
  return pick as Exercise['difficulty']
}

/** One passage. The id is the lexicographically smallest copy at the chosen difficulty. Tags are the union. */
export function chooseCanonicalExercise(group: readonly Exercise[]): Exercise {
  if (group.length === 0) throw new Error('empty passage group')

  const difficulty = lowerMedianDifficulty(group.map((exercise) => exercise.difficulty))
  const representative = [...group]
    .filter((exercise) => exercise.difficulty === difficulty)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]

  const source = representative ?? group[0]
  const tags = [...new Set(group.flatMap((exercise) => exercise.tags))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  return { ...source, difficulty, tags }
}
