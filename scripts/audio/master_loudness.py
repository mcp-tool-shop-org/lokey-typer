"""Measure a bed and gain it toward -32 LUFS.

The same ebur128 read as check_loudness.py decides the gain. The result is
written only to --output. This command refuses to write inside
public/audio/ambient, and it does not edit manifest.json.

A file that is already at the peak cap and still quieter than -35 LUFS is
written at that cap and reported. Linear gain cannot invent loudness the
waveform does not have.

Usage:
  python scripts/audio/master_loudness.py --self-test
  python scripts/audio/master_loudness.py --input some.wav --output some/dir
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from check_loudness import TARGET_MAX, TARGET_MIN, measure_lufs

TARGET_LUFS = -32.0
PEAK_CAP = 0.89


def gain_toward(measured_lufs: float, peak: float, target: float = TARGET_LUFS, cap: float = PEAK_CAP) -> float:
    if peak <= 0 or measured_lufs != measured_lufs:
        return 1.0
    needed = 10 ** ((target - measured_lufs) / 20.0)
    if needed < 0:
        return 1.0
    capped = cap / peak
    if needed > capped:
        return capped
    return needed


def live_catalog() -> Path:
    return Path(__file__).resolve().parents[2] / "public" / "audio" / "ambient"


def is_inside(path: Path, root: Path) -> bool:
    resolved = path.resolve()
    root = root.resolve()
    return resolved == root or root in resolved.parents


def self_test() -> int:
    quiet = gain_toward(-38.0, 0.1)
    if not (1.9 < quiet < 2.1):
        print(f"FAIL gain for a quiet peak was {quiet}")
        return 1
    already = gain_toward(-32.0, 0.2)
    if abs(already - 1.0) > 1e-9:
        print(f"FAIL a bed at the target moved: {already}")
        return 1
    dense = gain_toward(-54.0, 0.89)
    if abs(dense - 1.0) > 1e-9:
        print(f"FAIL a peaked sub bed was pushed past the cap: {dense}")
        return 1
    silent = gain_toward(-40.0, 0.0)
    if silent != 1.0:
        print(f"FAIL a silent file was gained: {silent}")
        return 1
    if not (TARGET_MIN < TARGET_LUFS < TARGET_MAX):
        print("FAIL target sits outside the shared window")
        return 1
    print("OK gain math")
    return 0


def collect_inputs(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return sorted(item for item in path.rglob("*.wav") if item.is_file())


def apply_gain(src: Path, dest: Path, gain: float) -> None:
    import numpy as np
    import soundfile as sf

    data, rate = sf.read(src, always_2d=True)
    scaled = np.clip(data * gain, -1.0, 1.0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    sf.write(dest, scaled, rate, subtype="PCM_16")


def master_one(src: Path, dest: Path) -> int:
    measured, detail = measure_lufs(src)
    if measured is None:
        print(f"FAIL {src.as_posix()}: {detail}")
        return 1

    import soundfile as sf

    info = sf.info(src)
    peak = 0.0
    block = 262144
    with sf.SoundFile(src) as handle:
        while True:
            frames = handle.read(block, dtype="float32", always_2d=True)
            if len(frames) == 0:
                break
            peak = max(peak, float(abs(frames).max()))

    gain = gain_toward(measured, peak)
    apply_gain(src, dest, gain)
    after, after_detail = measure_lufs(dest)
    shown = f"{after:.1f}" if after is not None else after_detail
    window = TARGET_MIN <= after <= TARGET_MAX if after is not None else False
    state = "OK" if window else "OUTSIDE"
    print(
        f"{state} {src.name}: {measured:.1f} -> {shown} LUFS, "
        f"gain {gain:.4f}, peak {peak:.4f}, {info.samplerate} Hz, wrote {dest.as_posix()}"
    )
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Gain beds toward -32 LUFS without touching the live catalog.")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    if args.input is None or args.output is None:
        parser.print_usage(sys.stderr)
        print("FAIL pass --input and --output, or --self-test", file=sys.stderr)
        return 2

    catalog = live_catalog()
    if is_inside(args.output, catalog):
        print("FAIL output is inside public/audio/ambient. Write to another folder.")
        return 2

    sources = collect_inputs(args.input)
    if not sources:
        print(f"FAIL no wavs at {args.input.as_posix()}")
        return 1

    failed = 0
    for src in sources:
        relative = src.name if args.input.is_file() else src.relative_to(args.input)
        dest = args.output / relative
        if dest.resolve() == src.resolve():
            print(f"FAIL refusing to overwrite {src.as_posix()}")
            failed += 1
            continue
        failed += master_one(src, dest)

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
