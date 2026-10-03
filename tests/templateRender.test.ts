import { describe, it, expect } from 'vitest'
import { isTemplateExercise, renderTemplateExercise } from '../src/lib/templateRender'

describe('isTemplateExercise', () => {
  it('returns true for template type', () => {
    expect(isTemplateExercise({ type: 'template' } as any)).toBe(true)
  })

  it('returns false for static type', () => {
    expect(isTemplateExercise({ type: 'static' } as any)).toBe(false)
  })

  it('returns false for missing type', () => {
    expect(isTemplateExercise({} as any)).toBe(false)
  })
})

describe('renderTemplateExercise', () => {
  it('replaces slots with values', () => {
    const ex = {
      id: 'test-1',
      type: 'template' as const,
      template: 'Hello {name}, welcome to {place}.',
      slots: {
        name: ['Alice', 'Bob'],
        place: ['Paris', 'London'],
      },
    }
    const result = renderTemplateExercise(ex as any, { seed: 'fixed-seed' })
    // Should resolve both slots (not contain braces)
    expect(result).not.toContain('{')
    expect(result).not.toContain('}')
    expect(result).toMatch(/Hello \w+, welcome to \w+\./)
  })

  it('is deterministic with same seed', () => {
    const ex = {
      id: 'det-test',
      type: 'template' as const,
      template: '{greeting} {name}!',
      slots: {
        greeting: ['Hi', 'Hey', 'Hello'],
        name: ['World', 'Friend', 'Stranger'],
      },
    }
    const a = renderTemplateExercise(ex as any, { seed: 'same-seed' })
    const b = renderTemplateExercise(ex as any, { seed: 'same-seed' })
    expect(a).toBe(b)
  })

  it('falls back to slot name for empty slots', () => {
    const ex = {
      id: 'empty-slots',
      type: 'template' as const,
      template: 'Value: {missing}',
      slots: { missing: [] },
    }
    const result = renderTemplateExercise(ex as any, { seed: 'seed' })
    expect(result).toBe('Value: missing')
  })

  it('reuses same value for repeated slot references', () => {
    const ex = {
      id: 'repeat',
      type: 'template' as const,
      template: '{x} and {x}',
      slots: { x: ['alpha', 'beta'] },
    }
    const result = renderTemplateExercise(ex as any, { seed: 'seed' })
    const [left, right] = result.split(' and ')
    expect(left).toBe(right)
  })
})
