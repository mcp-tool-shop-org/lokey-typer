import { describe, expect, it } from 'vitest'
import { acceptTypingEdit } from '../src/lib/typingEdit'

describe('acceptTypingEdit', () => {
  it('accepts one typed character and a backspace', () => {
    expect(acceptTypingEdit('hel', 'hell')).toBe(true)
    expect(acceptTypingEdit('hell', 'hel')).toBe(true)
  })

  it('rejects a paste that would finish the passage', () => {
    expect(acceptTypingEdit('', 'Slow is smooth; smooth is fast.')).toBe(false)
    expect(acceptTypingEdit('Slow', 'Slow is smooth; smooth is fast.')).toBe(false)
  })

  it('accepts clearing a selection', () => {
    expect(acceptTypingEdit('hello', 'h')).toBe(true)
  })

  it('accepts one middle insert or delete and rejects a longer insert', () => {
    expect(acceptTypingEdit('hllo', 'hello')).toBe(true)
    expect(acceptTypingEdit('hello', 'heXXllo')).toBe(false)
    expect(acceptTypingEdit('hello', 'hllo')).toBe(true)
  })
})
