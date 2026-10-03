"""
Generate seamless-looping ambient audio stems for LoKey-Typer.

Each stem is procedurally synthesized (no samples needed), crossfaded
into itself for seamless looping, and normalized to ~-32 LUFS.

Usage:
    python scripts/audio/generate_ambient_stems.py

Output:
    public/audio/ambient/{mode}/{profile}/{layer}/*.wav
"""

import os
import json
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

SAMPLE_RATE = 44100
BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "audio", "ambient")
CROSSFADE_SEC = 2.0
TARGET_PEAK = 0.15  # conservative peak to land around -32 LUFS

# ── Utility ────────────────────────────────────────────────────────

def brown_noise(n_samples: int, rng: np.random.Generator) -> np.ndarray:
    """Generate brown noise via cumulative sum of white noise."""
    white = rng.standard_normal(n_samples)
    brown = np.cumsum(white)
    # Remove DC drift
    brown -= np.linspace(brown[0], brown[-1], n_samples)
    return brown / (np.abs(brown).max() + 1e-12)


def pink_noise(n_samples: int, rng: np.random.Generator) -> np.ndarray:
    """Approximate pink noise using Voss-McCartney algorithm."""
    n_rows = 16
    out = np.zeros(n_samples)
    rows = rng.standard_normal((n_rows, n_samples))
    # Each row updates at progressively slower rates
    for i in range(n_rows):
        step = 2 ** i
        held = np.repeat(rows[i, ::step], step)[:n_samples]
        out += held
    out /= n_rows
    return out / (np.abs(out).max() + 1e-12)


def white_noise(n_samples: int, rng: np.random.Generator) -> np.ndarray:
    w = rng.standard_normal(n_samples)
    return w / (np.abs(w).max() + 1e-12)


def sine_wave(freq: float, n_samples: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n_samples) / SAMPLE_RATE
    return np.sin(2 * np.pi * freq * t + phase)


def lfo(rate_hz: float, n_samples: int, phase: float = 0.0) -> np.ndarray:
    """Slow sine LFO, range [0, 1]."""
    return 0.5 + 0.5 * sine_wave(rate_hz, n_samples, phase)


def lowpass(data: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    sos = butter(order, cutoff, btype="low", fs=SAMPLE_RATE, output="sos")
    return sosfilt(sos, data)


def highpass(data: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    sos = butter(order, cutoff, btype="high", fs=SAMPLE_RATE, output="sos")
    return sosfilt(sos, data)


def bandpass(data: np.ndarray, low: float, high: float, order: int = 4) -> np.ndarray:
    sos = butter(order, [low, high], btype="band", fs=SAMPLE_RATE, output="sos")
    return sosfilt(sos, data)


def apply_slow_filter_sweep(data: np.ndarray, base_cutoff: float,
                            sweep_range: float, lfo_rate: float,
                            rng: np.random.Generator) -> np.ndarray:
    """Apply a slowly varying lowpass filter by processing in chunks."""
    chunk_size = SAMPLE_RATE // 4  # 250ms chunks
    n = len(data)
    mod = lfo(lfo_rate, n, phase=rng.uniform(0, 2 * np.pi))
    out = np.zeros(n)

    for start in range(0, n, chunk_size):
        end = min(start + chunk_size, n)
        mid = (start + end) // 2
        cutoff = base_cutoff + sweep_range * mod[mid]
        cutoff = np.clip(cutoff, 40, SAMPLE_RATE * 0.45)
        chunk = data[start:end]
        out[start:end] = lowpass(chunk, cutoff, order=2)

    return out


def crossfade_loop(audio: np.ndarray, fade_samples: int) -> np.ndarray:
    """Make audio seamlessly loopable via raised-cosine crossfade."""
    n = len(audio)
    if n <= fade_samples * 2:
        return audio

    # The tail overlaps with the head
    fade_in = 0.5 * (1 - np.cos(np.pi * np.arange(fade_samples) / fade_samples))
    fade_out = 1.0 - fade_in

    result = audio.copy()
    # Blend tail into head
    result[:fade_samples] = audio[:fade_samples] * fade_in + audio[n - fade_samples:] * fade_out
    # Trim the tail (it's now baked into the head)
    result = result[:n - fade_samples]
    return result


def normalize(audio: np.ndarray, target_peak: float = TARGET_PEAK) -> np.ndarray:
    peak = np.abs(audio).max()
    if peak < 1e-12:
        return audio
    return audio * (target_peak / peak)


def gentle_fade_in(audio: np.ndarray, seconds: float = 0.5) -> np.ndarray:
    """Apply a gentle fade-in to avoid click at start."""
    n = int(seconds * SAMPLE_RATE)
    n = min(n, len(audio))
    fade = 0.5 * (1 - np.cos(np.pi * np.arange(n) / n))
    audio = audio.copy()
    audio[:n] *= fade
    return audio


def generate_stem(synth_fn, duration_sec: float, rng: np.random.Generator) -> np.ndarray:
    """Generate a loopable stem: synthesize with overlap, crossfade, normalize."""
    fade_samples = int(CROSSFADE_SEC * SAMPLE_RATE)
    total_samples = int(duration_sec * SAMPLE_RATE) + fade_samples

    raw = synth_fn(total_samples, rng)
    looped = crossfade_loop(raw, fade_samples)
    looped = gentle_fade_in(looped)
    return normalize(looped)


# ── Synth functions per layer ──────────────────────────────────────

def synth_low_bed_warm(n: int, rng: np.random.Generator) -> np.ndarray:
    """Warm sub-bass bed: filtered brown noise with slow LFO on cutoff."""
    noise = brown_noise(n, rng)
    swept = apply_slow_filter_sweep(noise, base_cutoff=120, sweep_range=60,
                                     lfo_rate=0.03 + rng.uniform(0, 0.02), rng=rng)
    # Add a very quiet sub-sine for body
    sub = sine_wave(55 + rng.uniform(-5, 5), n) * 0.15
    return lowpass(swept + sub, 200)


def synth_low_bed_deep(n: int, rng: np.random.Generator) -> np.ndarray:
    """Deeper variant with lower cutoff and slower movement."""
    noise = brown_noise(n, rng)
    swept = apply_slow_filter_sweep(noise, base_cutoff=90, sweep_range=40,
                                     lfo_rate=0.02 + rng.uniform(0, 0.01), rng=rng)
    sub = sine_wave(45 + rng.uniform(-3, 3), n) * 0.2
    return lowpass(swept + sub, 160)


def synth_low_bed_bright(n: int, rng: np.random.Generator) -> np.ndarray:
    """Slightly brighter bed for competitive mode."""
    noise = brown_noise(n, rng)
    swept = apply_slow_filter_sweep(noise, base_cutoff=180, sweep_range=80,
                                     lfo_rate=0.04 + rng.uniform(0, 0.02), rng=rng)
    return lowpass(swept, 280)


def synth_mid_texture_pad(n: int, rng: np.random.Generator) -> np.ndarray:
    """Warm pad: layered detuned sines with slow amplitude modulation."""
    base_freq = 220 + rng.uniform(-10, 10)
    detune = rng.uniform(0.5, 2.0)

    s1 = sine_wave(base_freq, n)
    s2 = sine_wave(base_freq + detune, n, phase=rng.uniform(0, 2 * np.pi))
    s3 = sine_wave(base_freq * 2 + rng.uniform(-2, 2), n, phase=rng.uniform(0, 2 * np.pi))
    s4 = sine_wave(base_freq * 0.5, n) * 0.5

    chord = s1 + s2 * 0.8 + s3 * 0.3 + s4 * 0.4
    # Slow amplitude modulation
    mod = lfo(0.05 + rng.uniform(0, 0.03), n, phase=rng.uniform(0, 2 * np.pi))
    mod = 0.6 + 0.4 * mod  # range [0.6, 1.0]
    return lowpass(chord * mod, 2000)


def synth_mid_texture_shimmer(n: int, rng: np.random.Generator) -> np.ndarray:
    """Shimmery harmonic texture with gentle beating."""
    base = 330 + rng.uniform(-15, 15)
    s1 = sine_wave(base, n)
    s2 = sine_wave(base * 1.002, n)  # very slight detuning for shimmer
    s3 = sine_wave(base * 0.749, n, phase=rng.uniform(0, np.pi)) * 0.5  # fifth below
    s4 = sine_wave(base * 1.498, n) * 0.25  # fifth above, quiet

    mix = s1 + s2 + s3 + s4
    mod = lfo(0.04 + rng.uniform(0, 0.02), n) * 0.3 + 0.7
    return lowpass(mix * mod, 3000)


def synth_mid_texture_organic(n: int, rng: np.random.Generator) -> np.ndarray:
    """Organic texture: filtered noise + sine blend for nature profile."""
    noise = pink_noise(n, rng)
    filtered = bandpass(noise, 200, 1500)
    tone = sine_wave(165 + rng.uniform(-8, 8), n) * 0.3
    mod = lfo(0.06 + rng.uniform(0, 0.03), n) * 0.4 + 0.6
    return (filtered * 0.7 + tone) * mod


def synth_mid_presence_clean(n: int, rng: np.random.Generator) -> np.ndarray:
    """Mid presence for competitive: brighter filtered noise with resonance."""
    noise = pink_noise(n, rng)
    filtered = bandpass(noise, 400, 3000)
    swept = apply_slow_filter_sweep(filtered, base_cutoff=2000, sweep_range=800,
                                     lfo_rate=0.05 + rng.uniform(0, 0.02), rng=rng)
    return swept


def synth_mid_presence_focused(n: int, rng: np.random.Generator) -> np.ndarray:
    """Tighter mid presence with slight tonal character."""
    noise = pink_noise(n, rng)
    filtered = bandpass(noise, 500, 2500)
    tone = sine_wave(440 + rng.uniform(-20, 20), n) * 0.15
    mod = lfo(0.03, n) * 0.3 + 0.7
    return (filtered + tone) * mod


def synth_mid_presence_airy(n: int, rng: np.random.Generator) -> np.ndarray:
    """Airy mid presence — lighter, more breath-like."""
    noise = white_noise(n, rng)
    filtered = bandpass(noise, 800, 4000)
    mod = lfo(0.07 + rng.uniform(0, 0.03), n) * 0.35 + 0.65
    return filtered * mod * 0.6


def synth_air_gentle(n: int, rng: np.random.Generator) -> np.ndarray:
    """Gentle airy breath: high-passed pink noise with slow filter drift."""
    noise = pink_noise(n, rng)
    hp = highpass(noise, 2000)
    swept = apply_slow_filter_sweep(hp, base_cutoff=5000, sweep_range=2000,
                                     lfo_rate=0.02 + rng.uniform(0, 0.015), rng=rng)
    mod = lfo(0.03 + rng.uniform(0, 0.02), n) * 0.25 + 0.75
    return swept * mod


def synth_air_soft(n: int, rng: np.random.Generator) -> np.ndarray:
    """Softer air with less high frequency content."""
    noise = pink_noise(n, rng)
    hp = highpass(noise, 1500)
    lp = lowpass(hp, 6000)
    mod = lfo(0.025 + rng.uniform(0, 0.015), n) * 0.2 + 0.8
    return lp * mod


def synth_air_breeze(n: int, rng: np.random.Generator) -> np.ndarray:
    """Breeze-like air for nature profile — wider, more organic movement."""
    noise = pink_noise(n, rng)
    hp = highpass(noise, 1000)
    # More pronounced LFO for breeze-like swells
    mod = lfo(0.08 + rng.uniform(0, 0.04), n) * 0.45 + 0.55
    swept = apply_slow_filter_sweep(hp, base_cutoff=4000, sweep_range=2500,
                                     lfo_rate=0.06, rng=rng)
    return swept * mod


def synth_room_wash(n: int, rng: np.random.Generator) -> np.ndarray:
    """Ultra-quiet reverb-like room wash."""
    noise = white_noise(n, rng)
    filtered = lowpass(noise, 1200)
    filtered = highpass(filtered, 80)
    # Very slow, very subtle
    mod = lfo(0.015 + rng.uniform(0, 0.01), n) * 0.15 + 0.85
    return filtered * mod * 0.4


def synth_room_deep(n: int, rng: np.random.Generator) -> np.ndarray:
    """Deeper room tone — more low-end."""
    noise = white_noise(n, rng)
    filtered = lowpass(noise, 800)
    filtered = highpass(filtered, 40)
    mod = lfo(0.01 + rng.uniform(0, 0.01), n) * 0.1 + 0.9
    return filtered * mod * 0.35


def synth_room_air(n: int, rng: np.random.Generator) -> np.ndarray:
    """Room with slightly more air — nature variant."""
    noise = white_noise(n, rng)
    filtered = lowpass(noise, 2000)
    filtered = highpass(filtered, 100)
    mod = lfo(0.02 + rng.uniform(0, 0.015), n) * 0.2 + 0.8
    return filtered * mod * 0.35


# ── Profile definitions ────────────────────────────────────────────

PROFILES = {
    "focus_soft": {
        "mode": "focus",
        "layers": {
            "low_bed": [synth_low_bed_warm, synth_low_bed_warm, synth_low_bed_deep],
            "mid_texture": [synth_mid_texture_pad, synth_mid_texture_pad, synth_mid_texture_shimmer],
            "air": [synth_air_gentle, synth_air_soft, synth_air_gentle],
        },
    },
    "focus_warm": {
        "mode": "focus",
        "layers": {
            "low_bed": [synth_low_bed_deep, synth_low_bed_deep, synth_low_bed_warm],
            "mid_texture": [synth_mid_texture_shimmer, synth_mid_texture_pad, synth_mid_texture_shimmer],
            "air": [synth_air_soft, synth_air_gentle, synth_air_soft],
            "room": [synth_room_wash, synth_room_deep, synth_room_wash],
        },
    },
    "competitive_clean": {
        "mode": "competitive",
        "layers": {
            "low_bed": [synth_low_bed_bright, synth_low_bed_bright, synth_low_bed_warm],
            "mid_presence": [synth_mid_presence_clean, synth_mid_presence_focused, synth_mid_presence_airy],
            "air": [synth_air_gentle, synth_air_gentle, synth_air_soft],
        },
    },
    "nature_air": {
        "mode": "focus",
        "layers": {
            "low_bed": [synth_low_bed_warm, synth_low_bed_deep, synth_low_bed_warm],
            "mid_texture": [synth_mid_texture_organic, synth_mid_texture_organic, synth_mid_texture_pad],
            "air": [synth_air_breeze, synth_air_breeze, synth_air_gentle],
            "room": [synth_room_air, synth_room_wash, synth_room_air],
        },
    },
}

DURATIONS = [40, 45, 50]  # seconds — vary per variant


def main():
    manifest_stems = []
    total_files = 0

    for profile_id, profile_def in PROFILES.items():
        mode = profile_def["mode"]
        layers = profile_def["layers"]

        for layer_name, synth_fns in layers.items():
            for variant_idx, synth_fn in enumerate(synth_fns):
                variant_num = variant_idx + 1
                stem_id = f"{profile_id}_{layer_name}_{variant_num:02d}"
                duration = DURATIONS[variant_idx % len(DURATIONS)]

                # Deterministic but unique seed per stem
                seed = hash(stem_id) & 0xFFFFFFFF
                rng = np.random.default_rng(seed)

                print(f"  Generating {stem_id} ({duration}s)...")
                audio = generate_stem(synth_fn, duration, rng)

                # Build output path
                rel_dir = os.path.join(mode, profile_id, layer_name)
                out_dir = os.path.join(BASE_DIR, rel_dir)
                os.makedirs(out_dir, exist_ok=True)

                filename = f"{stem_id}.wav"
                out_path = os.path.join(out_dir, filename)
                sf.write(out_path, audio, SAMPLE_RATE, subtype="PCM_16")

                manifest_stems.append({
                    "id": stem_id,
                    "mode": mode,
                    "profile": profile_id,
                    "layer": layer_name,
                    "path": f"/audio/ambient/{rel_dir}/{filename}".replace("\\", "/"),
                    "length_sec": round(len(audio) / SAMPLE_RATE, 1),
                    "lufs_i": -32,
                })
                total_files += 1

    # Write manifest
    manifest = {"version": 2, "stems": manifest_stems}
    manifest_path = os.path.join(BASE_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone! Generated {total_files} stems.")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
