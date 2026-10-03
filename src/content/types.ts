export type Mode = 'focus' | 'real_life' | 'competitive'

export type PackMode = Mode | 'mixed'

export type ExerciseTargets = {
  min_accuracy?: number
  focus_keys?: string[]
  bigrams?: string[]
}

export type ExerciseBase = {
  id: string
  mode: Mode
  pack: string
  title: string
  difficulty: 1 | 2 | 3 | 4 | 5
  estimated_seconds: number
  tags: string[]
  targets?: ExerciseTargets
}

export type ExerciseText = ExerciseBase & {
  // Content packs may provide either a single `text` field or explicit variants.
  type?: undefined
  text?: string
  text_short?: string
  text_long?: string
}

export type TemplateRenderRules = {
  max_variants?: number
  seeded?: boolean
}

export type ExerciseTemplate = ExerciseBase & {
  type: 'template'
  template: string
  slots: Record<string, string[]>
  render_rules?: TemplateRenderRules
}

export type Exercise = ExerciseText | ExerciseTemplate

export type ContentPack = {
  // Packs may use either `pack` or `pack_id`.
  pack?: string
  pack_id?: string
  mode: PackMode
  version?: number
  exercises: Exercise[]
}
