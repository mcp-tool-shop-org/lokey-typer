"""
Optimize all SVG icons using Inkscape's built-in optimizer.
Cleans up paths, removes unnecessary metadata, minifies.
"""

import os
import subprocess
import sys

INKSCAPE = r'C:\Program Files\Inkscape\bin\inkscape.exe'
ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'icons')


def optimize_svg(filepath: str):
    """Run Inkscape vacuum-defs + export-plain-svg on a file."""
    tmp = filepath + '.tmp.svg'
    result = subprocess.run(
        [
            INKSCAPE,
            filepath,
            '--batch-process',
            '--actions=vacuum-defs;export-filename:{};export-plain-svg;export-do'.format(tmp),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
        os.replace(tmp, filepath)
        return True
    else:
        # Clean up failed tmp
        if os.path.exists(tmp):
            os.remove(tmp)
        return False


def main():
    svgs = sorted(f for f in os.listdir(ICONS_DIR) if f.endswith('.svg'))
    print(f'Optimizing {len(svgs)} SVG icons with Inkscape...\n')

    success = 0
    fail = 0

    for name in svgs:
        path = os.path.join(ICONS_DIR, name)
        before = os.path.getsize(path)
        try:
            ok = optimize_svg(path)
            if ok:
                after = os.path.getsize(path)
                saved = before - after
                pct = (saved / before * 100) if before > 0 else 0
                print(f'  + {name}: {before}B -> {after}B ({pct:.0f}% saved)')
                success += 1
            else:
                print(f'  - {name}: optimization failed (kept original)')
                fail += 1
        except Exception as e:
            print(f'  ! {name}: error - {e}')
            fail += 1

    print(f'\nDone! {success} optimized, {fail} failed.')


if __name__ == '__main__':
    main()
