Place optional typewriter sound samples here.

The app will try to preload these files:
- key_1.wav, key_2.wav, key_3.wav, key_4.wav
- spacebar.wav
- backspace.wav
- return_bell.wav
- error.wav

If files are missing, the app uses a low-latency synthesized fallback (Web Audio) so sound still works.

## Ambient layers (Phase 3)

The ambient system supports optional file-based layers (WAV) that follow a strict naming convention so the engine can swap and validate layers automatically.

If ambient files are missing, the app falls back to a safe synthesized ambience and never crashes.

**Directory structure**

- `audio/ambient/focus/soft/`
	- `focus_soft_low_bed_v1.wav`
	- `focus_soft_mid_texture_v1.wav`
	- `focus_soft_air_v1.wav`
- `audio/ambient/focus/warm/`
	- `focus_warm_low_bed_v1.wav`
	- `focus_warm_mid_texture_v1.wav`
- `audio/ambient/competitive/clean/`
	- `comp_clean_low_bed_v1.wav`
	- `comp_clean_mid_presence_v1.wav`
	- `comp_clean_air_v1.wav`
- `audio/ambient/nature/air/`
	- `nature_air_broadband_v1.wav`

**File requirements**

- Format: WAV (recommended 48kHz / 24-bit)
- Duration: ≥ 120s (prefer 180–300s)
- Loopable / click-free, no DC offset, no discrete events
