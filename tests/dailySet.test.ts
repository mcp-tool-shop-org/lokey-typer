import { describe, expect, it } from 'vitest'
import { findExercise } from '../src/content/loadPacks'
import { generateDailySet } from '../src/lib/dailySet'
import { isScreenReaderSafePassage } from '../src/lib/passageShape'

describe('generateDailySet screen reader', () => {
  it('keeps every item short and single-line', () => {
    const set = generateDailySet({
      userId: 'daily-sr-test',
      dateKey: '2026-10-03',
      sessionType: 'mix',
      screenReaderMode: true,
    })

    expect(set.items.length).toBeGreaterThan(0)
    for (const item of set.items) {
      const exercise = findExercise(item.exerciseId)
      expect(exercise).not.toBeNull()
      expect(isScreenReaderSafePassage(exercise!)).toBe(true)
    }
  })

  it('repeats the same items for the same day', () => {
    const args = {
      userId: 'daily-sr-stable',
      dateKey: '2026-10-03',
      sessionType: 'reset' as const,
      screenReaderMode: true,
    }
    const a = generateDailySet(args)
    const b = generateDailySet(args)
    expect(a.items.map((item) => item.exerciseId)).toEqual(b.items.map((item) => item.exerciseId))
  })
})
