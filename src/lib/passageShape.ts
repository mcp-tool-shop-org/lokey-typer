type Passage = {
  tags?: readonly string[]
  text?: string
  text_short?: string
  text_long?: string
  template?: string
}

function isNewlineTag(tag: string): boolean {
  return tag === 'multiline' || tag === 'newlines'
}

/** Packs tag multiline copy `newlines`. The skill model records `multiline`. */
export function tagMatches(packTags: readonly string[], skillTag: string): boolean {
  if (packTags.includes(skillTag)) return true
  if (!isNewlineTag(skillTag)) return false
  return packTags.includes('multiline') || packTags.includes('newlines')
}

export function weaknessForTag(
  weakness: Record<string, number> | undefined,
  tag: string,
): number {
  if (!weakness) return 0
  const direct = weakness[tag]
  if (Number.isFinite(direct) && direct > 0) return direct
  if (!isNewlineTag(tag)) return 0
  const other = weakness[tag === 'newlines' ? 'multiline' : 'newlines']
  return Number.isFinite(other) && other > 0 ? other : 0
}

function fieldHasNewline(value: string | undefined): boolean {
  return typeof value === 'string' && value.includes('\n')
}

export function isMultilinePassage(ex: Passage): boolean {
  const tags = ex.tags ?? []
  if (tags.includes('multiline') || tags.includes('newlines')) return true
  // Each field on its own. Joining them with a newline marks every copied line as multiline.
  return (
    fieldHasNewline(ex.template) ||
    fieldHasNewline(ex.text) ||
    fieldHasNewline(ex.text_short) ||
    fieldHasNewline(ex.text_long)
  )
}

export function isScreenReaderSafePassage(ex: Passage & { estimated_seconds: number }): boolean {
  return ex.estimated_seconds <= 60 && !isMultilinePassage(ex)
}
