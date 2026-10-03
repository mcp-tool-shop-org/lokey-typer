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
