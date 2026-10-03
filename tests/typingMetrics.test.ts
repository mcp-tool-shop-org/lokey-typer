import { describe, it, expect } from 'vitest'
import { computeLiveMetrics } from '../src/lib/typingMetrics'

describe('computeLiveMetrics', () => {
  it('returns perfect accuracy for exact match', () => {
    const m = computeLiveMetrics({ target: 'hello', typed: 'hello', elapsedMs: 60000 })
    expect(m.correctChars).toBe(5)
    expect(m.incorrectChars).toBe(0)
    expect(m.accuracy).toBe(1)
    expect(m.errors).toBe(0)
  })

  it('calculates WPM correctly (5 chars = 1 word)', () => {
    // 25 correct chars in 1 minute = 5 words/min
    const m = computeLiveMetrics({ target: 'a'.repeat(25), typed: 'a'.repeat(25), elapsedMs: 60000 })
    expect(m.wpm).toBe(5)
  })

  it('handles zero elapsed time (returns 0 WPM)', () => {
    const m = computeLiveMetrics({ target: 'hello', typed: 'hello', elapsedMs: 0 })
    expect(m.wpm).toBe(0)
  })

  it('counts incorrect characters', () => {
    const m = computeLiveMetrics({ target: 'hello', typed: 'hxllo', elapsedMs: 60000 })
    expect(m.correctChars).toBe(4)
    expect(m.incorrectChars).toBe(1)
    expect(m.accuracy).toBeCloseTo(0.8)
  })

  it('counts excess typed characters as incorrect', () => {
    const m = computeLiveMetrics({ target: 'hi', typed: 'hiiii', elapsedMs: 60000 })
    expect(m.correctChars).toBe(2)
    expect(m.incorrectChars).toBe(3)
  })

  it('handles empty typed string', () => {
    const m = computeLiveMetrics({ target: 'hello', typed: '', elapsedMs: 60000 })
    expect(m.correctChars).toBe(0)
    expect(m.incorrectChars).toBe(0)
    expect(m.accuracy).toBe(1) // 0/0 → 1
    expect(m.wpm).toBe(0)
  })

  it('handles empty target string', () => {
    const m = computeLiveMetrics({ target: '', typed: 'abc', elapsedMs: 60000 })
    expect(m.incorrectChars).toBe(3)
    expect(m.accuracy).toBe(0)
  })

  it('WPM only counts correct characters', () => {
    // 10 correct + 5 incorrect in 30 seconds = 10/5 = 2 words in 0.5 min = 4 WPM
    const m = computeLiveMetrics({ target: 'a'.repeat(15), typed: 'a'.repeat(10) + 'x'.repeat(5), elapsedMs: 30000 })
    expect(m.correctChars).toBe(10)
    expect(m.wpm).toBe(4)
  })
})
