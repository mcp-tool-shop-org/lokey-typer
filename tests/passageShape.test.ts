import { describe, expect, it } from 'vitest'
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

  it('keeps a short single-line passage', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'Slow is smooth.',
        estimated_seconds: 45,
      }),
    ).toBe(true)
  })

  it('drops a passage that runs longer than a minute', () => {
    expect(
      isScreenReaderSafePassage({
        tags: ['sentences'],
        text: 'Slow is smooth.',
        estimated_seconds: 90,
      }),
    ).toBe(false)
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
