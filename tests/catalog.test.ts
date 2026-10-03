import { describe, expect, it } from 'vitest'
import { findExercise, loadExercisesByMode } from '../src/content/loadPacks'
import { lowerMedianDifficulty, passageKey } from '../src/content/catalog'

describe('passage catalog', () => {
  it('picks the lower median difficulty when copies disagree', () => {
    expect(lowerMedianDifficulty([1, 3, 4])).toBe(3)
    expect(lowerMedianDifficulty([1, 3])).toBe(1)
    expect(lowerMedianDifficulty([1, 2, 3, 4])).toBe(2)
  })

  it('keeps one copy of a repeated sentence and still opens the old ids', () => {
    const easy = findExercise('focus_calm_01_001')
    const mid = findExercise('focus_calm_03_001')
    const later = findExercise('focus_calm_03_034')

    const text = 'Slow is smooth; smooth is fast. A calm start creates a calm finish.'
    expect(easy?.text_short).toBe(text)
    expect(mid?.text_short).toBe(text)
    expect(later?.text_short).toBe(text)
    expect(easy?.difficulty).toBe(3)
    expect(mid?.difficulty).toBe(3)
    expect(later?.difficulty).toBe(3)

    const copies = loadExercisesByMode('focus').filter((exercise) => (exercise.text_short ?? exercise.text) === text)
    expect(copies.map((exercise) => exercise.id)).toEqual(['focus_calm_03_001'])
  })

  it('does not list the same passage twice in a mode', () => {
    for (const mode of ['focus', 'real_life', 'competitive'] as const) {
      const pool = loadExercisesByMode(mode)
      const keys = pool.map((exercise) => passageKey(exercise))
      expect(new Set(keys).size).toBe(pool.length)
    }
  })
})
