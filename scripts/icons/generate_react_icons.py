"""
Generate a single React/TypeScript icon component file from all SVG icons.

Reads every .svg in src/assets/icons/ and produces:
  src/app/components/Icon.tsx

Usage in React:
  import { Icon } from '@app/components/Icon'
  <Icon name="mode-focus" size={20} className="text-zinc-400" />
"""

import os
import re

ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'icons')
OUT_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'app', 'components', 'Icon.tsx')


def svg_to_inner(svg_content: str) -> str:
    """Extract the inner content of an SVG (everything between <svg> and </svg>)."""
    # Remove the <svg ...> opening tag
    inner = re.sub(r'<svg[^>]*>\n?', '', svg_content)
    # Remove </svg>
    inner = re.sub(r'</svg>\n?', '', inner)
    # Trim whitespace
    inner = inner.strip()
    return inner


def name_to_key(filename: str) -> str:
    """Convert filename to a valid TS string key: 'mode-focus.svg' -> 'mode-focus'"""
    return filename.replace('.svg', '')


def main():
    svgs = sorted(f for f in os.listdir(ICONS_DIR) if f.endswith('.svg'))
    print(f'Building React Icon component from {len(svgs)} SVGs...')

    # Build the icon map
    entries = []
    for fname in svgs:
        key = name_to_key(fname)
        path = os.path.join(ICONS_DIR, fname)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        inner = svg_to_inner(content)
        # Convert to JSX: self-closing tags, attribute names
        # stroke-width -> strokeWidth, etc.
        inner = inner.replace('stroke-width', 'strokeWidth')
        inner = inner.replace('stroke-linecap', 'strokeLinecap')
        inner = inner.replace('stroke-linejoin', 'strokeLinejoin')
        # Make sure all tags are properly self-closed for JSX
        # <circle ... /> is already fine
        # <line ... /> is already fine
        entries.append((key, inner))

    # Generate the TypeScript file
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

    lines = []
    lines.append("// AUTO-GENERATED — do not edit manually.")
    lines.append("// Run: python scripts/icons/generate_react_icons.py")
    lines.append("")
    lines.append("const ICONS: Record<string, string> = {")

    for key, inner in entries:
        # Escape backticks and ${} in template literals
        escaped = inner.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
        lines.append(f"  '{key}': `{escaped}`,")

    lines.append("}")
    lines.append("")

    # Type for icon names
    names = [e[0] for e in entries]
    lines.append("export type IconName =")
    for i, name in enumerate(names):
        sep = "" if i == len(names) - 1 else ""
        lines.append(f"  | '{name}'")
    lines.append("")

    # The component
    lines.append("type IconProps = {")
    lines.append("  name: IconName")
    lines.append("  size?: number")
    lines.append("  className?: string")
    lines.append("  'aria-label'?: string")
    lines.append("  'aria-hidden'?: boolean")
    lines.append("}")
    lines.append("")
    lines.append("export function Icon({")
    lines.append("  name,")
    lines.append("  size = 24,")
    lines.append("  className = '',")
    lines.append("  'aria-label': ariaLabel,")
    lines.append("  'aria-hidden': ariaHidden = !ariaLabel,")
    lines.append("}: IconProps) {")
    lines.append("  const inner = ICONS[name]")
    lines.append("  if (!inner) return null")
    lines.append("")
    lines.append("  return (")
    lines.append("    <svg")
    lines.append("      xmlns=\"http://www.w3.org/2000/svg\"")
    lines.append("      width={size}")
    lines.append("      height={size}")
    lines.append("      viewBox=\"0 0 24 24\"")
    lines.append("      fill=\"none\"")
    lines.append("      stroke=\"currentColor\"")
    lines.append("      strokeWidth={1.5}")
    lines.append("      strokeLinecap=\"round\"")
    lines.append("      strokeLinejoin=\"round\"")
    lines.append("      className={className}")
    lines.append("      aria-label={ariaLabel}")
    lines.append("      aria-hidden={ariaHidden}")
    lines.append("      role={ariaLabel ? 'img' : undefined}")
    lines.append("      dangerouslySetInnerHTML={{ __html: inner }}")
    lines.append("    />")
    lines.append("  )")
    lines.append("}")
    lines.append("")

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'Generated: {OUT_FILE}')
    print(f'  {len(entries)} icons, type IconName exported')


if __name__ == '__main__':
    main()
