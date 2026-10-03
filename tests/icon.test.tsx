// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, type IconName } from '../src/app/components/Icon'

const iconNames = {
  'ambient-air': true,
  'ambient-drive': true,
  'ambient-soft': true,
  'ambient-warm': true,
  'ambient-wave': true,
  'arrow-left': true,
  'arrow-right': true,
  backspace: true,
  'bar-chart': true,
  bookmark: true,
  calendar: true,
  check: true,
  'checkmark-circle': true,
  'chevron-down': true,
  'chevron-right': true,
  clock: true,
  cursor: true,
  'difficulty-1': true,
  'difficulty-2': true,
  'difficulty-3': true,
  'difficulty-4': true,
  'difficulty-5': true,
  external: true,
  'eye-off': true,
  eye: true,
  filter: true,
  ghost: true,
  grid: true,
  hash: true,
  heart: true,
  home: true,
  info: true,
  keyboard: true,
  'kind-challenge': true,
  'kind-confidence': true,
  'kind-mix': true,
  'kind-real-life': true,
  'kind-targeted': true,
  list: true,
  'logo-mark': true,
  logo: true,
  'medal-bronze': true,
  'medal-gold': true,
  'medal-silver': true,
  medal: true,
  minus: true,
  'mode-competitive': true,
  'mode-focus': true,
  'mode-real-life': true,
  'personal-best': true,
  'play-circle': true,
  play: true,
  plus: true,
  question: true,
  refresh: true,
  search: true,
  settings: true,
  shuffle: true,
  'sound-off': true,
  'sound-on': true,
  star: true,
  'stat-accuracy': true,
  'stat-days': true,
  'stat-sessions': true,
  'stat-speed': true,
  'stat-streak': true,
  timer: true,
  'trending-down': true,
  'trending-up': true,
  trophy: true,
  'type-text': true,
  wrench: true,
  'x-close': true,
  zap: true,
} satisfies Record<IconName, true>

const names = Object.keys(iconNames) as IconName[]

describe('Icon', () => {
  it('renders every icon name and the unknown-name branch', () => {
    const { container, rerender } = render(
      <>
        {names.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </>,
    )

    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(names.length)
    svgs.forEach((svg) => {
      expect(svg.getAttribute('width')).toBe('24')
      expect(svg.getAttribute('height')).toBe('24')
      expect(svg.getAttribute('class')).toBe('')
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.getAttribute('role')).toBeNull()
      expect(svg.innerHTML.length).toBeGreaterThan(0)
    })

    rerender(<Icon name={'not-an-icon' as IconName} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('applies size, className, and accessible-name props', () => {
    const { rerender } = render(
      <Icon name="check" size={18} className="text-zinc-500" aria-label="Done" />,
    )

    const labeled = screen.getByRole('img', { name: 'Done' })
    expect(labeled.getAttribute('width')).toBe('18')
    expect(labeled.getAttribute('height')).toBe('18')
    expect(labeled.classList.contains('text-zinc-500')).toBe(true)
    expect(labeled.getAttribute('aria-hidden')).toBe('false')

    rerender(<Icon name="play" size={12} aria-label="Play" aria-hidden />)
    const forcedHidden = document.querySelector('svg')
    expect(forcedHidden?.getAttribute('width')).toBe('12')
    expect(forcedHidden?.getAttribute('aria-label')).toBe('Play')
    expect(forcedHidden?.getAttribute('role')).toBe('img')
    expect(forcedHidden?.getAttribute('aria-hidden')).toBe('true')
  })
})
