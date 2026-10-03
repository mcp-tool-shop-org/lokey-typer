/**
 * A typing attempt may insert at most one character per change.
 * Deletes of any size stay, so a selection can be cleared. A paste cannot.
 */
export function acceptTypingEdit(prev: string, next: string): boolean {
  if (next === prev) return true
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
  const added = next.length - prefix - suffix
  return added <= 1
}
