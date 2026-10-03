export type TypingStats = {
  elapsedMs: number
  correctChars: number
  incorrectChars: number
  accuracy: number
  wpm: number
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function computeStats(params: {
  startedAtMs: number | null
  nowMs: number
  correctChars: number
  incorrectChars: number
}): TypingStats {
  const elapsedMs = params.startedAtMs == null ? 0 : Math.max(0, params.nowMs - params.startedAtMs)
  const total = params.correctChars + params.incorrectChars
  const accuracy = total === 0 ? 1 : clamp(params.correctChars / total, 0, 1)

  const minutes = elapsedMs / 60000
  const words = params.correctChars / 5
  const wpm = minutes > 0 ? words / minutes : 0

  return {
    elapsedMs,
    correctChars: params.correctChars,
    incorrectChars: params.incorrectChars,
    accuracy,
    wpm,
  }
}

export function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
