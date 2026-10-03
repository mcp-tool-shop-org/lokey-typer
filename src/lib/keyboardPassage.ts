// Keyboard equivalents only. Letters, including U+00E9, stay as they are.
// Replacements are not in this map, so a second call is a no-op.
const KEYBOARD_FOLD: Readonly<Record<string, string>> = {
  '\u2018': '\u0027',
  '\u2019': '\u0027',
  '\u201c': '\u0022',
  '\u201d': '\u0022',
  '\u2013': '\u002d',
  '\u2014': '\u002d',
  '\u2011': '\u002d',
  '\u00a0': ' ',
  '\u2026': '...',
}

export function keyboardPassage(text: string): string {
  let out = ''
  for (const ch of text) out += KEYBOARD_FOLD[ch] ?? ch
  return out
}
