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


def analyze(path: Path) -> dict[str, float]:
    y, sr = librosa.load(path, sr=None, mono=True)
    if y.size == 0:
        return {"centroid": 0.0, "high_ratio": 0.0, "low_ratio": 0.0}

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
        print("WARN no .wav files found (nothing to check)")
        return 0

    failed = False

    for wav in wavs:
        r = analyze(wav)
        problems = []

        if r["centroid"] > 1500:
            problems.append(f"centroid {r['centroid']:.0f}Hz")

        if r["high_ratio"] > 0.20:
            problems.append(f">4kHz {r['high_ratio'] * 100:.1f}%")

        if r["low_ratio"] > 0.15:
            problems.append(f"<80Hz {r['low_ratio'] * 100:.1f}%")

        if problems:
            failed = True
            print(f"FAIL {wav.as_posix()}: {', '.join(problems)}")
        else:
            print(f"OK   {wav.as_posix()}")

    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/audio/check_spectrum.py public/audio/ambient")
        raise SystemExit(2)

    raise SystemExit(main(sys.argv[1]))
