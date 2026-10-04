import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('favicon plate', () => {
  it('paints the mark on cream so a dark theme color does not show through', () => {
    const svg = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8')
    expect(svg).toContain('fill="#FCFAEF"')
    expect(svg).toContain('stroke="#00444D"')
  })
})
