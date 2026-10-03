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

export function isMultilinePassage(ex: Passage): boolean {
  const tags = ex.tags ?? []
  if (tags.includes('multiline') || tags.includes('newlines')) return true
  const text = [ex.text, ex.text_short, ex.text_long, ex.template].filter(Boolean).join('\n')
  return text.includes('\n')
}

export function isScreenReaderSafePassage(ex: Passage & { estimated_seconds: number }): boolean {
  return ex.estimated_seconds <= 60 && !isMultilinePassage(ex)
}
