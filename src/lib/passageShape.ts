type Passage = {
  tags?: readonly string[]
  text?: string
  text_short?: string
  text_long?: string
  template?: string
}

// Packs say `newlines` and `dash`. The skill model records `multiline` and `dashes`.
const TAG_ALIASES: Readonly<Record<string, string>> = {
  multiline: 'newlines',
  newlines: 'multiline',
  dash: 'dashes',
  dashes: 'dash',
}

/** Exact pack tag wins. `dash`/`dashes` and `multiline`/`newlines` are the only aliases. */
export function tagMatches(packTags: readonly string[], skillTag: string): boolean {
  if (packTags.includes(skillTag)) return true
  const other = TAG_ALIASES[skillTag]
  if (other == null) return false
  return packTags.includes(other)
}

export function weaknessForTag(
  weakness: Record<string, number> | undefined,
  tag: string,
): number {
  if (!weakness) return 0
  const direct = weakness[tag]
  if (Number.isFinite(direct) && direct > 0) return direct
  const otherName = TAG_ALIASES[tag]
  if (otherName == null) return 0
  const other = weakness[otherName]
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
