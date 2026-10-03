/** The stem generator faded this much of the head in after the loop crossfade. */
export const LOOP_JOIN_SECONDS = 0.5

/**
 * Blend the tail across a faded head so a native loop does not join a hot
 * sample to silence. Sample 0 takes the tail. The end of the window keeps
 * the body that already sits there.
 */
export function repairLoopHead(data: Float32Array, fadeSamples: number): Float32Array {
  const n = data.length
  if (fadeSamples < 2 || n <= fadeSamples * 2) return data
  const out = new Float32Array(data)
  const last = fadeSamples - 1
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / last
    const tail = data[n - fadeSamples + i]
    out[i] = tail * (1 - t) + data[i] * t
  }
  return out
}
