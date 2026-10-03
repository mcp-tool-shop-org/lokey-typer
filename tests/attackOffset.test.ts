import { describe, expect, it } from 'vitest'
import { attackOffsetSamples } from '../src/lib/attackOffset'

describe('attackOffsetSamples', () => {
  it('skips leading silence and starts at the click', () => {
    const channel = new Float32Array(100)
    channel[40] = 0.66
    expect(attackOffsetSamples(channel)).toBe(40)
  })

  it('starts at zero when the transient is already at the head', () => {
    const channel = new Float32Array(20)
    channel[0] = 0.4
    expect(attackOffsetSamples(channel)).toBe(0)
  })

  it('returns zero for silence', () => {
    expect(attackOffsetSamples(new Float32Array(16))).toBe(0)
  })
})
