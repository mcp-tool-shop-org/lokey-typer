export type LiveMetrics = {
  correctChars: number
  incorrectChars: number
  errors: number
  accuracy: number // 0..1
  wpm: number
}

export function computeLiveMetrics(params: {
  target: string
  typed: string
  elapsedMs: number
}): LiveMetrics {
  let correctChars = 0
  let incorrectChars = 0

  for (let i = 0; i < params.typed.length; i++) {
    if (i >= params.target.length) {
      incorrectChars++
      continue
    }
    if (params.typed[i] === params.target[i]) correctChars++
    else incorrectChars++
  }

  const totalTyped = correctChars + incorrectChars
  const accuracy = totalTyped === 0 ? 1 : correctChars / totalTyped

  const minutes = params.elapsedMs / 60000
  const words = correctChars / 5
  const wpm = minutes > 0 ? words / minutes : 0

  return {
    correctChars,
    incorrectChars,
    errors: incorrectChars,
    accuracy,
    wpm,
  }
}
