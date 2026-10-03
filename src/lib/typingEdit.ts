/**
 * A typing attempt may insert at most one grapheme per change.
 * Deletes of any size stay, so a selection can be cleared. A paste cannot.
 */

export function graphemesOf(value: string): string[] {
  if (value.length === 0) return []
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...segmenter.segment(value)].map((part) => part.segment)
}

export function addedSpan(prev: string, next: string): { index: number; text: string } {
  let prefix = 0
  const max = Math.min(prev.length, next.length)
  while (prefix < max && prev[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (
    suffix < prev.length - prefix &&
    suffix < next.length - prefix &&
    prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }
  return { index: prefix, text: next.slice(prefix, next.length - suffix) }
}

export function acceptTypingEdit(prev: string, next: string): boolean {
  if (next === prev) return true
  return graphemesOf(addedSpan(prev, next).text).length <= 1
}
