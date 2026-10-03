import { describe, expect, it } from 'vitest'
import { keyboardPassage } from '../src/lib/keyboardPassage'

describe('keyboardPassage', () => {
  it('folds only the typographic punctuation onto keyboard characters', () => {
    expect(keyboardPassage('\u2018')).toBe('\u0027')
    expect(keyboardPassage('\u2019')).toBe('\u0027')
    expect(keyboardPassage('\u201C')).toBe('\u0022')
    expect(keyboardPassage('\u201D')).toBe('\u0022')
    expect(keyboardPassage('\u2013')).toBe('\u002D')
    expect(keyboardPassage('\u2014')).toBe('\u002D')
    expect(keyboardPassage('\u2011')).toBe('\u002D')
    expect(keyboardPassage('\u00A0')).toBe(' ')
    expect(keyboardPassage('\u2026')).toBe('\u002E\u002E\u002E')
    expect(keyboardPassage('\u2010')).toBe('\u2010')
  })

  it('leaves every letter alone, including U+00E9', () => {
    const letters = 'Slow is smooth. caf\u00E9'
    expect(keyboardPassage(letters)).toBe(letters)
  })

  it('returns the same string on a second call', () => {
    const source = 'It\u2019s a \u201Ctest\u201D\u2014caf\u00E9\u2026\u00A0next'
    const once = keyboardPassage(source)
    expect(once).toBe('It\'s a "test"-caf\u00E9... next')
    expect(keyboardPassage(once)).toBe(once)
  })
})
