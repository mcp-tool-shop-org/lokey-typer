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

  it('repeats a short single line out to a competitive sprint', () => {
    const base = 'Slow is smooth.'
    const out = repeatPassage(base, 1800)
    expect(out.length).toBeGreaterThanOrEqual(1800)
    expect(out.includes('\n')).toBe(false)
    const parts = out.split(base)
    expect(parts.length - 1).toBeGreaterThan(10)
    expect(parts.every((part) => part === '' || part === ' ')).toBe(true)
  })
})
