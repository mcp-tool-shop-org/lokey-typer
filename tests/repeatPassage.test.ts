import { describe, expect, it } from 'vitest'
import { repeatPassage } from '../src/lib/repeatPassage'

describe('repeatPassage', () => {
  it('repeats a single-line sentence without turning the sprint into paragraphs', () => {
    const out = repeatPassage('Slow is smooth.', 40)
    expect(out.includes('\n')).toBe(false)
    expect(out.length).toBeGreaterThanOrEqual(40)
    expect(out.startsWith('Slow is smooth.')).toBe(true)
  })

  it('keeps a paragraph break when the passage already has one', () => {
    const out = repeatPassage('line one\nline two', 30)
    expect(out.includes('\n\n')).toBe(true)
  })
})
