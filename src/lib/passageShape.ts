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

// Runs store `punctuation`. Packs tag the same misses as comma, colon, or semicolon.
const PUNCTUATION_PACK_TAGS: ReadonlySet<string> = new Set(['comma', 'colon', 'semicolon'])

function positiveScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Exact pack tag wins. `punctuation` also matches pack tags comma, colon, and semicolon. */
export function tagMatches(packTags: readonly string[], skillTag: string): boolean {
  if (packTags.includes(skillTag)) return true
  const other = TAG_ALIASES[skillTag]
  if (other != null && packTags.includes(other)) return true
  if (skillTag === 'punctuation') return packTags.some((tag) => PUNCTUATION_PACK_TAGS.has(tag))
  return false
}

export function weaknessForTag(
  weakness: Record<string, number> | undefined,
  tag: string,
): number {
  if (!weakness) return 0
  const direct = positiveScore(weakness[tag])
  if (direct > 0) return direct
  const otherName = TAG_ALIASES[tag]
  if (otherName != null) {
    const other = positiveScore(weakness[otherName])
    if (other > 0) return other
  }
  if (PUNCTUATION_PACK_TAGS.has(tag)) {
    const punct = positiveScore(weakness.punctuation)
    if (punct > 0) return punct
  }
  if (tag === 'punctuation') {
    for (const packTag of PUNCTUATION_PACK_TAGS) {
      const score = positiveScore(weakness[packTag])
      if (score > 0) return score
    }
  }
  return 0
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

function typedBody(ex: Passage): string {
  if (typeof ex.template === 'string' && ex.template.length > 0) return ex.template
  return ex.text_short ?? ex.text ?? ex.text_long ?? ''
}

// Safety is the typed line. estimated_seconds is a practice-time label, not a length cap.
export function isScreenReaderSafePassage(ex: Passage & { estimated_seconds: number }): boolean {
  if (isMultilinePassage(ex)) return false
  return typedBody(ex).length <= 160
}
