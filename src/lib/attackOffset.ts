/**
 * First sample that reaches `ratio` of the peak.
 * Key recordings often leave 10–50 ms of silence before the click.
 */
export function attackOffsetSamples(channel: Float32Array, ratio = 0.08): number {
  let peak = 0
  for (let i = 0; i < channel.length; i++) {
    const a = Math.abs(channel[i])
    if (a > peak) peak = a
  }
  if (peak < 1e-4) return 0
  const gate = peak * ratio
  for (let i = 0; i < channel.length; i++) {
    if (Math.abs(channel[i]) >= gate) return i
  }
  return 0
}
