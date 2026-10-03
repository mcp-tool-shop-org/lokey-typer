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
})
