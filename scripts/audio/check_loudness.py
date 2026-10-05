"""Loudness gate for ambient stems.

Checks integrated loudness (EBU R128) using ffmpeg's ebur128 filter.

Acceptance range:
  Target: -30 to -34 LUFS
  Tolerance: ±1 LUFS
  => hard fail outside [-35, -29]

A bed named for loudness in kept-beds.json may sit outside that window.
The name holds only while the measurement is outside. An unnamed file
still hard-fails. The wav bytes are not changed.

Usage:
  python scripts/audio/check_loudness.py public/audio/ambient

Requirements:
  - ffmpeg on PATH
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from kept_beds import load_kept

TARGET_MIN = -35.0
TARGET_MAX = -29.0

_I_RE = re.compile(r"\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS\b")
_FRAME_RE = re.compile(r"\bt:\s*\d")


def _unreadable(returncode: int, stderr: str) -> str:
    """Return code plus error or summary lines. The per-frame log is noise."""
    kept: list[str] = []
    for line in stderr.splitlines():
        text = line.strip()
        if not text or _FRAME_RE.search(text):
            continue
        kept.append(text)
    tail = "\n".join(kept[-20:])
    lead = (
        f"Could not read integrated LUFS. ffmpeg exit {returncode}. "
        "The stem was not measured, so it is not known to be inside the fatigue window."
    )
    return f"{lead}\n{tail}" if tail else lead


def measure_lufs(path: Path) -> tuple[float | None, str]:
    """Integrated loudness from the same ebur128 read the gate uses."""
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        str(path),
        "-filter_complex",
        "ebur128=framelog=verbose",
        "-f",
        "null",
        "-",
    ]

    try:
        proc = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, check=False)
    except FileNotFoundError:
        return None, (
            "ffmpeg not found on PATH. "
            "The stem was not measured, so it is not known to be inside the fatigue window."
        )

    lufs = None
    for line in proc.stderr.splitlines():
        match = _I_RE.search(line)
        if match:
            try:
                lufs = float(match.group(1))
            except ValueError:
                pass

    if lufs is None:
        return None, _unreadable(proc.returncode, proc.stderr)

    return lufs, f"{lufs:.1f} LUFS"


def main(folder: str) -> int:
    root = Path(folder)
    if not root.exists():
        print(f"FAIL folder not found: {root}")
        return 2

    wavs = sorted(root.rglob("*.wav"))
    if not wavs:
        print(f"FAIL no .wav files found in {root}")
        return 1

    try:
        kept = load_kept()
    except ValueError as exc:
        print(f"FAIL {exc}")
        return 1

    failed = False
    seen: set[str] = set()
    for wav in wavs:
        rel = wav.relative_to(root).as_posix()
        seen.add(rel)
        entry = kept.get(rel)
        named = entry is not None and entry.loudness
        lufs, detail = measure_lufs(wav)
        if lufs is None:
            failed = True
            print(f"FAIL {wav.as_posix()}: {detail}")
            continue

        outside = not (TARGET_MIN <= lufs <= TARGET_MAX)
        if named and outside:
            print(
                f"KEPT {wav.as_posix()}: {lufs:.1f} LUFS "
                f"(outside [{TARGET_MIN:.0f}, {TARGET_MAX:.0f}]). Named bed: {entry.reason}"
            )
        elif named:
            failed = True
            print(
                f"FAIL {wav.as_posix()}: {lufs:.1f} LUFS is inside "
                f"[{TARGET_MIN:.0f}, {TARGET_MAX:.0f}]. "
                "This named bed no longer needs a loudness exception."
            )
        elif outside:
            failed = True
            print(f"FAIL {wav.as_posix()}: {lufs:.1f} LUFS (out of range [{TARGET_MIN:.0f}, {TARGET_MAX:.0f}])")
        else:
            print(f"OK   {wav.as_posix()}: {detail}")

    for rel, entry in sorted(kept.items()):
        if entry.loudness and rel not in seen:
            failed = True
            print(f"FAIL named loudness bed is not in this folder: {rel}")

    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/audio/check_loudness.py public/audio/ambient")
        raise SystemExit(2)

    raise SystemExit(main(sys.argv[1]))
