import type { Mode } from '@content'

export type MicroFeedbackInputs = {
  mode: Mode
  wpm: number
  accuracy: number
  errors: number
  backspaces: number
  duration_ms: number
  is_personal_best_wpm: boolean
  is_personal_best_accuracy: boolean
  delta_wpm_vs_best: number
  delta_accuracy_vs_best: number
}

export type MicroFeedback = {
  primary: string
  secondary?: string
  isNewPb: boolean
}

function fmt1(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1)
}

function calmPrimary(i: MicroFeedbackInputs) {
  if (i.is_personal_best_wpm && i.accuracy >= 0.97) return 'New personal best, and you kept it clean.'
  if (i.accuracy >= 0.99 && i.duration_ms >= 20_000) return 'Excellent control. That was very clean.'
  if (i.accuracy >= 0.98) return 'Strong accuracy. Nice, steady work.'
  if (i.accuracy >= 0.97 && i.errors <= 2) return 'Calm and consistent—great finish.'
  if (i.wpm >= 55 && i.accuracy >= 0.96) return 'Good pace, and you stayed in control.'
  if (i.backspaces <= 5 && i.duration_ms >= 20_000) return 'Minimal corrections. Smooth flow.'
  if (i.errors > 0 && i.accuracy >= 0.95) return 'Nice recovery. You kept moving steadily.'
  if (i.accuracy < 0.93) return 'Some keys were less consistent this run.'
  return 'Good session. Steady work.'
}

function calmSecondary(i: MicroFeedbackInputs) {
  if (i.backspaces >= 15) return 'Corrections were frequent.'
  if (i.errors >= 8) return 'Errors added up in a few spots.'
  if (i.wpm < 35 && i.duration_ms >= 30_000) return 'Pace stayed steady over the full run.'
  return ''
}

function competitivePrimary(i: MicroFeedbackInputs) {
  if (i.is_personal_best_wpm && i.accuracy >= 0.95) return 'New PB WPM. Still controlled.'
  if (i.is_personal_best_accuracy && i.duration_ms >= 20_000) return 'New PB accuracy. Clean run.'
  if (i.accuracy >= 0.99) return 'Elite accuracy. Plenty of control.'
  if (i.wpm >= 60 && i.accuracy >= 0.97) return 'Fast and clean. That’s the zone.'
  if (i.wpm >= 60 && i.accuracy < 0.95) return 'Pace is there. Tighten accuracy to convert it.'
  if (i.accuracy < 0.95) return 'Accuracy dipped. A cleaner run is available.'
  return 'Solid run. Clean speed is there.'
}

function competitiveSecondary(i: MicroFeedbackInputs) {
  if (i.delta_wpm_vs_best >= 1.0 && i.accuracy >= 0.95) {
    return `Up vs best: +${fmt1(i.delta_wpm_vs_best)} WPM.`
  }
  if (i.delta_wpm_vs_best <= -1.0) {
    return `Down vs best: ${fmt1(i.delta_wpm_vs_best)} WPM.`
  }
  if (i.backspaces >= 15) return 'Backspaces were frequent.'
  if (i.errors >= 10) return 'Errors spiked.'
  return ''
}

export function buildFeedback(i: MicroFeedbackInputs): MicroFeedback {
  const tone = i.mode === 'competitive' ? 'competitive' : 'calm'

  const primary = tone === 'competitive' ? competitivePrimary(i) : calmPrimary(i)
  const secondaryRaw = tone === 'competitive' ? competitiveSecondary(i) : calmSecondary(i)
  const secondary = secondaryRaw.trim().length > 0 ? secondaryRaw : undefined

  const isNewPb = i.is_personal_best_wpm || i.is_personal_best_accuracy

  return { primary, secondary, isNewPb }
}
