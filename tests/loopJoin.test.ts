import { describe, expect, it } from 'vitest'
import { repairLoopHead } from '../src/lib/ambient/loopJoin'

describe('repairLoopHead', () => {
  it('crossfades the whole faded head toward the tail without mutating the source', () => {
    const data = new Float32Array(20)
    for (let i = 0; i < 8; i++) data[i] = 0
    for (let i = 8; i < 20; i++) data[i] = 0.5
    const out = repairLoopHead(data, 8)
    expect(out).not.toBe(data)
    expect(data[0]).toBe(0)
    expect(out[0]).toBeCloseTo(0.5)
    expect(out[4]).toBeCloseTo(0.5 * (1 - 4 / 7))
    expect(out[19]).toBe(0.5)
  })

  it('leaves a buffer alone when the fade window does not fit', () => {
    const data = new Float32Array([0, 0.2, 0.4])
    expect(repairLoopHead(data, 8)).toBe(data)
  })
})
