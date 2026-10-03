/** 120s sprints need a longer target. Every other duration, including none, stays at 1800. */
export function competitiveMinLength(sprintDurationMs: number | undefined): number {
  if (sprintDurationMs === 120_000) return 4000
  return 1800
}

/**
 * Competitive sprints need a long target. A single-line passage stays one line.
 * A passage that already has line breaks repeats as another paragraph.
 */
export function repeatPassage(base: string, minLen: number): string {
  if (base.length === 0 || base.length >= minLen) return base
  const separator = base.includes('\n') ? '\n\n' : ' '
  let out = base
  while (out.length < minLen) out += separator + base
  return out
}
