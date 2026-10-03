import { useMemo } from 'react'

export function TypingOverlay({
  target,
  typed,
  showCursor,
  ghostIndex,
}: {
  target: string
  typed: string
  showCursor: boolean
  ghostIndex?: number | null
}) {
  const cursorIndex = typed.length

  const parts = useMemo(() => {
    const spans: Array<{
      text: string
      kind: 'correct' | 'incorrect' | 'pending' | 'cursor' | 'ghost'
    }> = []

    const max = Math.max(target.length, typed.length)
    for (let i = 0; i < max; i++) {
      const expected = i < target.length ? target[i] : ''
      const actual = i < typed.length ? typed[i] : ''

      if (ghostIndex != null && i === ghostIndex) {
        spans.push({ text: '', kind: 'ghost' })
      }

      if (showCursor && i === cursorIndex) {
        spans.push({ text: '', kind: 'cursor' })
      }

      if (i < typed.length) {
        const ok = i < target.length && actual === expected
        spans.push({ text: actual, kind: ok ? 'correct' : 'incorrect' })
      } else if (i < target.length) {
        spans.push({ text: expected, kind: 'pending' })
      }
    }

    if (ghostIndex != null && ghostIndex >= max) spans.push({ text: '', kind: 'ghost' })
    if (showCursor && cursorIndex >= max) spans.push({ text: '', kind: 'cursor' })

    // merge adjacent same kinds
    const merged: typeof spans = []
    for (const s of spans) {
      const prev = merged[merged.length - 1]
      if (prev && prev.kind === s.kind && s.kind !== 'cursor' && s.kind !== 'ghost') prev.text += s.text
      else merged.push({ ...s })
    }

    return merged
  }, [target, typed, showCursor, cursorIndex, ghostIndex])

  return (
    <div className="font-mono text-sm leading-6 whitespace-pre-wrap break-words">
      {parts.map((p, idx) => {
        if (p.kind === 'cursor') {
          return (
            <span
              key={`c-${idx}`}
              className="inline-block w-[2px] -mb-1 h-[1.2em] align-middle bg-zinc-300/70 cursor-blink"
            />
          )
        }

        if (p.kind === 'ghost') {
          return (
            <span
              key={`g-${idx}`}
              className="inline-block w-[2px] -mb-1 h-[1.2em] align-middle bg-zinc-50/25 ring-1 ring-zinc-400/30"
              title="Ghost (PB pace)"
            />
          )
        }

        const cls =
          p.kind === 'correct'
            ? 'text-zinc-50'
            : p.kind === 'incorrect'
              ? 'text-rose-400 underline decoration-current decoration-2 underline-offset-2'
              : 'text-zinc-500'

        return (
          <span
            key={`${p.kind}-${idx}`}
            className={cls}
          >
            {p.text}
          </span>
        )
      })}
    </div>
  )
}
