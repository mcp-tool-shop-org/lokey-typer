export const KEYBOARD_VOICES = ['mechanical', 'clicky', 'tick', 'muted'] as const

export type KeyboardVoice = (typeof KEYBOARD_VOICES)[number]

export const KEYBOARD_VOICE_CHOICES: readonly { id: KeyboardVoice; label: string; hint: string }[] = [
  { id: 'mechanical', label: 'Mechanical', hint: 'Rich, old switch' },
  { id: 'clicky', label: 'Clicky', hint: 'Bright snap' },
  { id: 'tick', label: 'Tick', hint: 'Short click' },
  { id: 'muted', label: 'Muted', hint: 'Quiet strike' },
]

export function isKeyboardVoice(value: unknown): value is KeyboardVoice {
  return typeof value === 'string' && (KEYBOARD_VOICES as readonly string[]).includes(value)
}
