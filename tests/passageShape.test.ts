import { describe, expect, it } from 'vitest'
import { findExercise } from '../src/content/loadPacks'
import { isScreenReaderSafePassage, tagMatches, weaknessForTag } from '../src/lib/passageShape'

describe('passage shape', () => {
  it('treats the pack tag newlines as multiline', () => {
    const ex = {
      tags: ['newlines'],
      text: 'Hello\nthere',
      estimated_seconds: 40,
    }
    expect(isScreenReaderSafePassage(ex)).toBe(false)
    expect(tagMatches(ex.tags, 'multiline')).toBe(true)
    expect(weaknessForTag({ multiline: 0.8 }, 'newlines')).toBe(0.8)
  })

  it('treats the pack tag dash and the recorded tag dashes as the same tag', () => {
    expect(tagMatches(['dash'], 'dashes')).toBe(true)
    expect(tagMatches(['dashes'], 'dash')).toBe(true)
    expect(weaknessForTag({ dashes: 0.8 }, 'dash')).toBe(0.8)
    expect(weaknessForTag({ dash: 0.8 }, 'dashes')).toBe(0.8)
    expect(tagMatches(['punctuation'], 'dashes')).toBe(false)
  })

  it('treats comma, colon, and semicolon pack tags as punctuation', () => {
    expect(tagMatches(['comma'], 'punctuation')).toBe(true)
    expect(tagMatches(['colon'], 'punctuation')).toBe(true)
    expect(tagMatches(['semicolon'], 'punctuation')).toBe(true)
    expect(weaknessForTag({ punctuation: 0.8 }, 'comma')).toBe(0.8)
    expect(weaknessForTag({ punctuation: 0.8 }, 'colon')).toBe(0.8)
    expect(weaknessForTag({ semicolon: 0.8 }, 'punctuation')).toBe(0.8)
    expect(weaknessForTag({ comma: 0.4 }, 'punctuation')).toBe(0.4)
  })

  it('keeps a short single-line passage', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'Slow is smooth.',
        estimated_seconds: 45,
      }),
    ).toBe(true)
  })

  it('keeps a short line when the estimate is longer than a minute', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'Slow is smooth.',
        estimated_seconds: 90,
      }),
    ).toBe(true)
  })

  it('drops a single line longer than 160 characters even when the estimate is 30 seconds', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'a'.repeat(160),
        estimated_seconds: 30,
      }),
    ).toBe(true)
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'a'.repeat(161),
        estimated_seconds: 30,
      }),
    ).toBe(false)
  })

  it('keeps the one-sentence competitive sprint whose estimate is 120 seconds', () => {
    const exercise = findExercise('competitive_mixed_01_001')
    expect(exercise).not.toBeNull()
    expect(exercise!.estimated_seconds).toBe(120)
    expect(isScreenReaderSafePassage(exercise!)).toBe(true)
  })

  it('keeps a passage when text, text_short, and text_long are the same single line', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'Slow is smooth.',
        text_short: 'Slow is smooth.',
        text_long: 'Slow is smooth.',
        estimated_seconds: 45,
      }),
    ).toBe(true)
  })

  it('drops a body that itself contains a newline', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'Slow is smooth.',
        text_short: 'Slow is smooth.',
        text_long: 'Slow is smooth.\nSmooth is fast.',
        estimated_seconds: 45,
      }),
    ).toBe(false)
  })

  it('still rejects a newlines tag when every body is one line', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['newlines'],
        text: 'Slow is smooth.',
        text_short: 'Slow is smooth.',
        text_long: 'Slow is smooth.',
        estimated_seconds: 45,
      }),
    ).toBe(false)
  })
})
