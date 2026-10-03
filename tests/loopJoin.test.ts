import { describe, expect, it } from 'vitest'
import { repairLoopHead } from '../src/lib/ambient/loopJoin'

describe('repairLoopHead', () => {
  it('makes sample 0 match the tail instead of the faded head', () => {
    const data = new Float32Array(20)
    for (let i = 0; i < 8; i++) data[i] = 0
    for (let i = 8; i < 20; i++) data[i] = 0.5
    const out = repairLoopHead(data, 8)
    expect(out[0]).toBeCloseTo(0.5)
    expect(out[7]).toBeCloseTo(data[7])
    expect(out[19]).toBe(0.5)
  })

  it('leaves a buffer alone when the fade window does not fit', () => {
    const data = new Float32Array([0, 0.2, 0.4])
    expect(repairLoopHead(data, 8)).toBe(data)
  })
})
