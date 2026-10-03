import type { Mode } from '@content'
import { loadLastMode } from './storage'

export type ModePath = 'focus' | 'real-life' | 'competitive'

export function pathToMode(path: ModePath): Mode {
  if (path === 'focus') return 'focus'
  if (path === 'competitive') return 'competitive'
  return 'real_life'
}

export function modeToPath(mode: Mode): ModePath {
  if (mode === 'focus') return 'focus'
  if (mode === 'competitive') return 'competitive'
  return 'real-life'
}

export function modeLabel(mode: Mode): string {
  if (mode === 'focus') return 'Focus'
  if (mode === 'competitive') return 'Competitive'
  return 'Real-Life'
}

export function preferredQuickstartMode(): Mode {
  return loadLastMode() ?? 'focus'
}
