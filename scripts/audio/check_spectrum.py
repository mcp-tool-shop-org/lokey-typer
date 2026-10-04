"""Spectral balance gate for ambient stems.

Computes simple spectral metrics for fatigue/alerting guardrails:
  - Mean spectral centroid (Hz)
  - High-frequency energy ratio (> 4 kHz)
  - Low-frequency energy ratio (< 80 Hz)

Targets:
  - centroid <= 1500 Hz
  - >4kHz ratio <= 0.20
  - <80Hz ratio <= 0.15

Usage:
  python scripts/audio/check_spectrum.py public/audio/ambient

Requirements:
  pip install -r scripts/audio/requirements.txt
"""

from __future__ import annotations

import sys
from pathlib import Path

import librosa
import numpy as np

CENTROID_CAP = 1500.0
HIGH_CAP = 0.20
LOW_CAP = 0.15


def analyze(path: Path) -> dict[str, float] | None:
    y, sr = librosa.load(path, sr=None, mono=True)
    if y.size == 0:
        return None

    S = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)

    centroid = float(librosa.feature.spectral_centroid(S=S, freq=freqs).mean())

    total_energy = float(S.sum())
    if total_energy <= 0:
        return {"centroid": centroid, "high_ratio": 0.0, "low_ratio": 0.0}

    high_energy = float(S[freqs > 4000].sum())
    low_energy = float(S[freqs < 80].sum())

    return {
        "centroid": centroid,
        "high_ratio": high_energy / total_energy,
        "low_ratio": low_energy / total_energy,
    }


def main(folder: str) -> int:
    root = Path(folder)
    if not root.exists():
        print(f"FAIL folder not found: {root}")
        return 2

    wavs = sorted(root.rglob("*.wav"))
    if not wavs:
        print(f"FAIL no .wav files found in {root}")
        return 1

    failed = False

    for wav in wavs:
        r = analyze(wav)
        if r is None:
            failed = True
            print(
                f"FAIL {wav.as_posix()}: empty buffer. "
                "The stem was not measured, so it is not inside the harsh-highs or low-rumble caps."
            )
            continue

        problems = []

        if r["centroid"] > CENTROID_CAP:
            problems.append("harsh highs")

        if r["high_ratio"] > HIGH_CAP:
            problems.append("harsh highs")

        if r["low_ratio"] > LOW_CAP:
            problems.append("low rumble")

        report = (
            f"centroid {r['centroid']:.0f} Hz (cap {CENTROID_CAP:.0f} Hz, harsh highs), "
            f">4 kHz {r['high_ratio']:.2f} (cap {HIGH_CAP:.2f}, harsh highs), "
            f"<80 Hz {r['low_ratio']:.2f} (cap {LOW_CAP:.2f}, low rumble)"
        )
        if problems:
            failed = True
            print(f"FAIL {wav.as_posix()}: {report}")
        else:
            print(f"OK   {wav.as_posix()}: {report}")

    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/audio/check_spectrum.py public/audio/ambient")
        raise SystemExit(2)

    raise SystemExit(main(sys.argv[1]))
