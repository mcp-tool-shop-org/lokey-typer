"""Length policy for ambient beds.

A bed under 180 seconds is heard once. A bed of 180 seconds or longer
keeps the player's 300–600 second hold. This gate does not fail a short
bed. It fails only when the folder has no bed long enough to hold.

Usage:
  python scripts/audio/check_bed_policy.py public/audio/ambient
"""

from __future__ import annotations

import sys
import wave
from pathlib import Path

LONG_BED_SEC = 180.0
HOLD_MIN_SEC = 300
HOLD_MAX_SEC = 600


def duration_sec(path: Path) -> float:
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate()
        if rate <= 0:
            raise ValueError("sample rate is 0")
        return handle.getnframes() / float(rate)


def main(folder: str) -> int:
    root = Path(folder)
    if not root.exists():
        print(f"FAIL folder not found: {root}")
        return 2

    wavs = sorted(root.rglob("*.wav"))
    if not wavs:
        print("FAIL no .wav files found")
        return 1

    print(
        f"POLICY a bed under {LONG_BED_SEC:.0f}s plays once. "
        f"A bed of {LONG_BED_SEC:.0f}s or more keeps the {HOLD_MIN_SEC}-{HOLD_MAX_SEC}s hold. "
        "A short bed is not a failure."
    )

    long_count = 0
    failed = False
    for wav in wavs:
        try:
            seconds = duration_sec(wav)
        except (wave.Error, EOFError, ValueError, OSError) as exc:
            print(f"FAIL {wav.as_posix()}: could not read duration ({exc})")
            failed = True
            continue

        if seconds >= LONG_BED_SEC:
            long_count += 1
            print(f"HOLD {wav.as_posix()}: {seconds:.1f}s")
        else:
            passes = HOLD_MIN_SEC / seconds if seconds > 0 else 0
            print(f"ONCE {wav.as_posix()}: {seconds:.1f}s (a {HOLD_MIN_SEC}s hold would repeat it {passes:.1f} times)")

    if long_count == 0:
        print(f"FAIL no bed is {LONG_BED_SEC:.0f}s or longer, so the hold has nothing to sit in")
        failed = True
    else:
        print(f"OK {long_count} bed(s) can sit through the hold")

    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/audio/check_bed_policy.py public/audio/ambient")
        raise SystemExit(2)

    raise SystemExit(main(sys.argv[1]))
