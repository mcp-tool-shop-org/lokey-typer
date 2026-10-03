import { describe, expect, it } from 'vitest'
import type { Exercise } from '../src/content/types'
import { updateSkillModelFromRun } from '../src/lib/skillModel'
import type { RunResult, UserSkillModel } from '../src/lib/storage'

const ALPHA = 0.2
const TARGET = "It's fine."

const exercise: Exercise = {
  id: 'ex-its-fine',
  mode: 'focus',
  pack: 'focus_calm_01',
  title: "It's fine.",
  difficulty: 1,
  estimated_seconds: 20,
  tags: ['apostrophe', 'punctuation'],
}

function lengthBucket(): UserSkillModel['performance_by_length']['short'] {
  return { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 }
}

function skillModel(params: {
  weakness_by_tag: Record<string, number>
  weak_tags: string[]
}): UserSkillModel {
  return {
    version: 2,
    updated_at: '2026-01-01T00:00:00.000Z',
    total_runs: 1,
    ema: { wpm: 0, accuracy: 1, backspace_rate: 0 },
    by_mode: {
      focus: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      real_life: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      competitive: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
    },
    errors_by_class: {},
    weakness_by_tag: params.weakness_by_tag,
    performance_by_length: {
      short: lengthBucket(),
      medium: lengthBucket(),
      long: lengthBucket(),
      multiline: lengthBucket(),
    },
    weak_tags: params.weak_tags,
    recent_exercise_ids_by_mode: {
      focus: [],
      real_life: [],
      competitive: [],
    },
  }
}

function run(tagsHit: string[]): RunResult {
  return {
    exercise_id: exercise.id,
    timestamp: 1_735_689_600,
    mode: 'focus',
    wpm: 48,
    accuracy: 1,
    errors: 0,
    backspaces: 1,
    duration_ms: 10_000,
    tags_hit: tagsHit,
  }
}

function update(params: {
  weakness_by_tag: Record<string, number>
  weak_tags: string[]
  tags_hit: string[]
  mistakes: Record<string, number>
}) {
  return updateSkillModelFromRun({
    prev: skillModel(params),
    run: run(params.tags_hit),
    exercise,
    targetText: TARGET,
    typedText: TARGET,
    mistakes: params.mistakes,
  })
}

describe('updateSkillModelFromRun', () => {
  it('raises one corrected apostrophe and decays punctuation that had no mistakes', () => {
    const next = update({
      weakness_by_tag: { apostrophe: 0, punctuation: 0.5 },
      weak_tags: [],
      tags_hit: ['apostrophe', 'punctuation'],
      mistakes: { apostrophe: 1 },
    })

    expect(next.weakness_by_tag.apostrophe).toBeCloseTo(0 + ALPHA * (1 - 0), 5)
    expect(next.weakness_by_tag.punctuation).toBeCloseTo(0.5 + ALPHA * (0 - 0.5), 5)
    expect([...next.weak_tags].sort()).toEqual(['apostrophe', 'punctuation'])
  })

  it('decays a clean punctuation tag to the floor and clears the previous weak_tags', () => {
    const next = update({
      weakness_by_tag: { punctuation: 0.001 },
      weak_tags: ['punctuation'],
      tags_hit: ['apostrophe', 'punctuation'],
      mistakes: {},
    })

    expect(next.weakness_by_tag.punctuation).toBeCloseTo(0.001 + ALPHA * (0 - 0.001), 5)
    expect(next.weakness_by_tag.punctuation).toBeLessThanOrEqual(0.001)
    expect(next.weak_tags).toEqual([])
  })

  it('does not teach apostrophe or punctuation from a letter mistake', () => {
    const next = update({
      weakness_by_tag: { apostrophe: 0, punctuation: 0 },
      weak_tags: [],
      tags_hit: ['punctuation', 'apostrophe'],
      mistakes: { letters: 1 },
    })

    expect(next.weakness_by_tag.apostrophe).toBe(0)
    expect(next.weakness_by_tag.punctuation).toBe(0)
  })
})
