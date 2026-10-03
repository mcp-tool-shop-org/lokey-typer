import type { ContentPack, Exercise, Mode, PackMode } from './types'

const modules = import.meta.glob('./packs/*.json', { eager: true }) as Record<
  string,
  { default: ContentPack }
>

type CachedContent = {
  packs: ContentPack[]
  exerciseById: Map<string, Exercise>
  exercisesByMode: Record<Mode, Exercise[]>
}

let cached: CachedContent | null = null

function extractTemplateSlots(template: string): string[] {
  const names = new Set<string>()
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_full, slotName: string) => {
    names.add(slotName)
    return ''
  })
  return Array.from(names)
}

function normalizeSlots(slots: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!slots || typeof slots !== 'object') return out
  for (const [k, v] of Object.entries(slots as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue
    const cleaned = (v as unknown[])
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0)
    if (cleaned.length > 0) out[k] = cleaned
  }
  return out
}

function isValidTemplateExercise(e: Exercise) {
  const eAny = e as unknown as { type?: unknown; template?: unknown; slots?: unknown }
  if (eAny.type !== 'template') return true

  const template = typeof eAny.template === 'string' ? eAny.template : ''
  const slots = normalizeSlots(eAny.slots)
  const required = extractTemplateSlots(template)
  if (required.length === 0) return true

  for (const slot of required) {
    const values = slots[slot]
    if (!Array.isArray(values) || values.length === 0) return false
  }

  return true
}

function buildCache(): CachedContent {
  const packs: ContentPack[] = Object.entries(modules).map(([path, m]) => {
    const raw = m.default
    const fallbackPack = path.split('/').pop()?.replace(/\.json$/i, '') ?? 'unknown_pack'
    const packName = raw.pack_id ?? raw.pack ?? fallbackPack

    const packMode = raw.mode as PackMode

    const exercises: Exercise[] = (raw.exercises ?? [])
      .map((e) => {
        const eAny = e as unknown as {
          type?: unknown
          text?: unknown
          text_short?: unknown
          text_long?: unknown
          mode?: Mode
          pack?: string
          tags?: string[]
          template?: unknown
          slots?: unknown
        }

        const isTemplate = eAny.type === 'template'

        // Mixed packs must set mode per exercise; otherwise fall back safely.
        const resolvedMode = eAny.mode ?? (packMode === 'mixed' ? 'real_life' : (packMode as Mode))

        const textShort =
          isTemplate ? undefined : ((eAny.text_short as string | undefined) ?? (eAny.text as string | undefined) ?? '')
        const textLong =
          isTemplate
            ? undefined
            : ((eAny.text_long as string | undefined) ?? (eAny.text as string | undefined) ?? textShort ?? '')

        const base: Exercise = {
          ...e,
          pack: eAny.pack ?? packName,
          mode: resolvedMode,
          tags: eAny.tags ?? [],
          ...(isTemplate
            ? {
                template: typeof eAny.template === 'string' ? eAny.template : '',
                slots: normalizeSlots(eAny.slots),
              }
            : { text_short: textShort, text_long: textLong }),
        } as Exercise

        if (!isValidTemplateExercise(base)) return null
        return base
      })
      .filter((x): x is Exercise => x != null)

    return {
      ...raw,
      pack: packName,
      exercises,
    }
  })

  const exerciseById = new Map<string, Exercise>()
  const exercisesByMode: Record<Mode, Exercise[]> = {
    focus: [],
    real_life: [],
    competitive: [],
  }

  for (const pack of packs) {
    for (const ex of pack.exercises) {
      if (!exerciseById.has(ex.id)) exerciseById.set(ex.id, ex)
      exercisesByMode[ex.mode].push(ex)
    }
  }

  return { packs, exerciseById, exercisesByMode }
}

function getCache(): CachedContent {
  if (!cached) cached = buildCache()
  return cached
}

export function loadAllPacks(): ContentPack[] {
  return getCache().packs
}

export function loadExercisesByMode(mode: Mode): Exercise[] {
  return getCache().exercisesByMode[mode]
}

export function findExercise(exerciseId: string): Exercise | null {
  return getCache().exerciseById.get(exerciseId) ?? null
}
